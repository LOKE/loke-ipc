/**
 * Starts timing something
 * @author Den Williams
 * @return {Timer} a timer instance to use for #stop()
 */
exports.start = function() {
  return process.hrtime();
};

/**
 * Stops timing something and returns the number of milliseconds elapsed
 * @author Den Williams
 * @param  {Timer} timer - the timer returned with #start()
 * @return {double} the number of milliseconds
 */
exports.stop = function(timer) {
  return exports._hrTimeToMs(process.hrtime(timer));
};

/**
 * Converts HRTime to milliseconds
 * @author Den Williams
 * @param  {HRTime} hrtime a hrtime array
 * @return {Number} the equivalent milliseconds
 */
exports._hrTimeToMs = function(hrtime) {
         // s to ms ......... ns to ms
  return (1000 * hrtime[0]) + (hrtime[1]/1000000);
};
