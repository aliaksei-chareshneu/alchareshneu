'use strict';
// Public synthetic arithmetic fixture; this function reduces a total by a specified amount (not a real discount).
function reduceByAmount(total, reduction) {
  return total - reduction;
}
module.exports = {reduceByAmount};
