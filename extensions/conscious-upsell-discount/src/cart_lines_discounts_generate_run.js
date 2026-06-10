import {
  DiscountClass,
  ProductDiscountSelectionStrategy,
} from '../generated/api';

/**
  * @typedef {import("../generated/api").CartInput} RunInput
  * @typedef {import("../generated/api").CartLinesDiscountsGenerateRunResult} CartLinesDiscountsGenerateRunResult
  */

/**
  * Upsell discount.
  *
  * For every cart line that carries a `_upsell_price` line item property, bring
  * its per-unit price down to that target value:
  *
  *   - No `_upsell_price` (missing/empty)         -> no discount
  *   - `_upsell_price` present, P > T             -> discount (P - T) per item
  *   - `_upsell_price` present, P <= T            -> no discount
  *   - `_upsell_price` = 0                         -> item free (P - 0 off)
  *
  * The dependency case (upsell removed when the main product leaves the cart) is
  * handled by the theme clearing the `_upsell_price` property — once the property
  * is gone, this function simply stops discounting that line.
  *
  * @param {RunInput} input
  * @returns {CartLinesDiscountsGenerateRunResult}
  */
export function cartLinesDiscountsGenerateRun(input) {
  if (!input.cart.lines.length) {
    return {operations: []};
  }

  if (!input.discount.discountClasses.includes(DiscountClass.Product)) {
    return {operations: []};
  }

  const candidates = [];

  for (const line of input.cart.lines) {
    const raw = line.upsellPrice?.value;
    if (raw == null || raw === '') {
      continue;
    }

    const target = Number.parseFloat(raw);
    if (Number.isNaN(target) || target < 0) {
      continue;
    }

    const perUnit = Number.parseFloat(line.cost.amountPerQuantity.amount);
    if (Number.isNaN(perUnit)) {
      continue;
    }

    // Only discount when the current price is above the target price.
    if (perUnit <= target) {
      continue;
    }

    const discountPerItem = perUnit - target;

    candidates.push({
      message: `Upsell price ${target}`,
      targets: [
        {
          cartLine: {
            id: line.id,
          },
        },
      ],
      value: {
        fixedAmount: {
          amount: discountPerItem.toFixed(2),
          appliesToEachItem: true,
        },
      },
    });
  }

  if (!candidates.length) {
    return {operations: []};
  }

  return {
    operations: [
      {
        productDiscountsAdd: {
          candidates,
          selectionStrategy: ProductDiscountSelectionStrategy.All,
        },
      },
    ],
  };
}
