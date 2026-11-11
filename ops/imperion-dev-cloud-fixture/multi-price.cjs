'use strict';
// Public synthetic fixture, not application pricing logic. This helper computes the total price by multiplying unit price with quantity, simulating pricing without actual business logic.
function netPrice(unitPrice, quantity) {
  return unitPrice * quantity;
}
module.exports = {netPrice};
