'use strict';
// Public synthetic fixture, not application pricing logic.
function netPrice(unitPrice, quantity) {
  return unitPrice * quantity;
}
function halfPrice(unitPrice, quantity) {
  const netPrice = unitPrice * quantity;
  return netPrice / 2;
}
module.exports = {netPrice, halfPrice};
