'use strict';
// Deliberately broken PUBLIC fixture, excluded from deployed application code.
function total(items) {
  return items.reduce((sum, row) => sum + row.price * (row.quantity || 0), 0);
}
module.exports = {total};
