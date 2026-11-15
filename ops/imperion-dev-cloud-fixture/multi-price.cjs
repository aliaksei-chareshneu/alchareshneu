'use strict';
// Public synthetic fixture for net price calculation, not real application pricing logic.
function netPrice(unitPrice, quantity) {
  return unitPrice * quantity;
}
module.exports = {netPrice};
