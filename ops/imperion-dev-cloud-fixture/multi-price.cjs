'use strict';
// Public synthetic fixture: simple net price calculator for unit price multiplied by quantity (not real pricing logic).
function netPrice(unitPrice, quantity) {
  return unitPrice * quantity;
}
module.exports = {netPrice};
