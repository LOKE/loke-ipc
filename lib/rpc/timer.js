/**
 * Converts HRTime to milliseconds
 * @author Den Williams
 * @param  {HRTime} hrtime a hrtime array
 * @return {Number} the equivalent milliseconds
 */
exports.hrTimeToMs = function(hrtime) {
         // s to ms ......... ns to ms
  return (1000 * hrtime[0]) + (hrtime[1]/1000000);
};
