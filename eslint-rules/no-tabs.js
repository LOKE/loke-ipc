/**
 * @fileoverview Disallow mixed spaces and tabs for indentation
 * @author Jary Niebur
 */
'use strict';

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

module.exports = function(context) {

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    return {

        Program: function(node) {
            var regex = /^ *\t/;

            context.getSource()
                .split(/\r?\n/g)
                .forEach(function(line, i) {
                    if (regex.exec(line)) {
                        context.report(node, { line: i + 1 }, 'Line ' + (i + 1) + ' has tabs, use spaces.');
                    }
                });
        }

    };

};
