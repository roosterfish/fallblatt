(function ( $ ) {
    $.fn.fallBlatt = function(options) {
        function scaleOutCanvas(element) {
            element.css({
                //"position": "absolute",
                "width": "100%",
                "height": "100%",
            })
        }

        function calculateCanvasSize(element) {
            scaleOutCanvas(element);

            var canvasHeight = element.height();
            var canvasWidth = element.width();
            var scaledFlapWidth = allOptions.flapWidth * allOptions.flapScale;
            var scaledFlapHeight = allOptions.flapHeight * allOptions.flapScale;
            var flapsXPadding = canvasWidth % (scaledFlapWidth + allOptions.flapSpacingExtraWidth);
            var flapsYPadding = canvasHeight % (scaledFlapHeight + allOptions.flapSpacingExtraHeight);
            var maxFlapsX = (canvasWidth-flapsXPadding) / (scaledFlapWidth + allOptions.flapSpacingExtraWidth);
            var maxFlapsY = (canvasHeight-flapsYPadding) / (scaledFlapHeight + allOptions.flapSpacingExtraHeight);

            if (maxFlapsX == 0 || maxFlapsY == 0) {
                throw new $.fn.fallBlatt.exception("Not enough space to render the split flaps");
            }
            return {
                canvasHeight: canvasHeight,
                canvasWidth: canvasWidth,
                // [Padding] X [Padding] X ... X [Padding] <-- Always add +1
                flapsXPadding: flapsXPadding / (maxFlapsX+1) + allOptions.flapSpacingExtraWidth / maxFlapsX * (maxFlapsX-1),
                flapsYPadding: flapsYPadding / (maxFlapsY+1) + allOptions.flapSpacingExtraHeight / maxFlapsY * (maxFlapsY-1),
                maxFlapsX: maxFlapsX,
                maxFlapsY: maxFlapsY
            }
        }

        function setSplitFlapCss() {
            // SplitFlap surrounding layers
            $(`.${allOptions.flapCss.flapContainerClass}`).css({
                   "height": allOptions.flapHeight,
                   "width": allOptions.flapWidth,
                   "transform": "scale(" + allOptions.flapScale + ")",
                   "transform-origin": "top left"
            });
        }

        function generateSplitFlapId(x, y) {
            return `splitflap-x${x}-y${y}`
        }

        function generateSplitFlap(x, y) {
            return `
                <div class="${allOptions.flapCss.flapContainerScaleClass}">
                    <div id="${generateSplitFlapId(x,y)}" class="${allOptions.flapCss.flapContainerClass}">
                        <div class="${allOptions.flapCss.flapContainerDividerBaseClass}">
                            <div class="${allOptions.flapCss.flapContainerDividerClass}"></div>
                            <div class="${allOptions.flapCss.flapContainerDividerLinkLeftClass}"></div>
                            <div class="${allOptions.flapCss.flapContainerDividerLinkRightClass}"></div>
                        </div>
                        <p><span class="${allOptions.flapCss.flapContainerCharClass}"> </span></p>
                    </div>
                </div>
            `
        }

        function setSplitFlapMargin(marginX, marginY) {
            // Map padding to CSS margin property
            $(`.${allOptions.flapCss.flapContainerScaleClass}`).css({
                "margin-left": marginX,
                "margin-top": marginY,
                "height": allOptions.flapHeight * allOptions.flapScale,
                "width": allOptions.flapWidth * allOptions.flapScale
            });
        }

        function drawCanvas(element, sizes) {
            for (var i=0; i<sizes.maxFlapsY; i++) {
                for (var j=0; j<sizes.maxFlapsX; j++) {
                    element.append(generateSplitFlap(j, i));
                }
            }
            setSplitFlapCss();
            setSplitFlapMargin(sizes.flapsXPadding, sizes.flapsYPadding);
        }

        function resetLayers(charMap) {
            $(`#${generateSplitFlapId(charMap.pos[0],charMap.pos[1])} 
               .${allOptions.flapCss.flapContainerCharClass}`)
                .attr("class", allOptions.flapCss.flapContainerCharClass);
        }

        function displayCharacterFlip(charMap, deferredObjects, resolve=false) {
            // Restore default css settings if earlier character modified the char class
            resetLayers(charMap);
            // Set new character
            $(`#${generateSplitFlapId(charMap.pos[0],charMap.pos[1])} 
               .${allOptions.flapCss.flapContainerCharClass}`).text(charMap.content);
            // Apply custom settings
            if (charMap.content in allOptions.flapCharset.options) {
                $(`#${generateSplitFlapId(charMap.pos[0],charMap.pos[1])} 
                   .${allOptions.flapCss.flapContainerCharClass}`).addClass(allOptions.flapCharset.options[charMap.content]);
            }
            setTimeout(function() {
                deferredObjects.char.resolve();
                // Finish rotation if last flip
                if (resolve) {
                    deferredObjects.splitflap.resolve();
                }
            }, 100);
        }

        function calculateRotationPath(oldChar, newChar) {
            var oldCharPos = allOptions.flapCharset.chars.indexOf(oldChar);
            var newCharPos = allOptions.flapCharset.chars.indexOf(newChar);
            var rotationPath = [];
            
            if (newCharPos > oldCharPos) {
                for (var i=oldCharPos+1; i<=newCharPos; i++) {
                    rotationPath.push(allOptions.flapCharset.chars[i]);
                }
            } else if (newCharPos < oldCharPos) {
                // Add all elements from oldCharPos -> End of charset
                for (var i=oldCharPos+1; i<allOptions.flapCharset.chars.length; i++) {
                    rotationPath.push(allOptions.flapCharset.chars[i]);
                }
                // Add all elements from Start of charset -> newCharPos
                for (var i=0; i<=newCharPos; i++) {
                    rotationPath.push(allOptions.flapCharset.chars[i]);
                }
            }
            // Return an empty list if oldChar == newChar
            return rotationPath;
        }

        function displayCharacter(charMap, deferredObject) {
            var oldChar = $(`#${generateSplitFlapId(charMap.pos[0],charMap.pos[1])} 
                            .${allOptions.flapCss.flapContainerCharClass}`).text();
            var rotationPath = calculateRotationPath(oldChar, charMap.content);
            var charDfd = {
                predecessor: $.Deferred().resolve(),
                successor: $.Deferred()
            }
            
            for (let i=0; i<rotationPath.length; i++) {
                // Make local copies (let) to prevent variable overwrite
                let charDfdpredecessor = charDfd.predecessor;
                let charDfdsuccessor = charDfd.successor;
                charDfdpredecessor.done(function() {
                    // Set new promise for successor flip
                    // Rotate from front to back layer
                    displayCharacterFlip({
                        pos: charMap.pos,
                        content: rotationPath[i]
                    }, 
                    {
                        // General promise for waiting until the wanted char is displayed
                        splitflap: deferredObject,
                        char: charDfdsuccessor
                    }, i == rotationPath.length-1 ? true : false);
                });
                // Rotate promises
                charDfd.predecessor = charDfdsuccessor;
                charDfd.successor = $.Deferred();
            }
        }

        var allOptions = $.extend({}, $.fn.fallBlatt.defaults, options);
        var allMethods = {
            init: function() {
                var sizes = calculateCanvasSize(this);
                drawCanvas(this, sizes);
                return {
                    this: this,
                    flapsX: sizes.maxFlapsX,
                    flapsY: sizes.maxFlapsY
                };
            },
            display: function(charMap) {
                var dfd = $.Deferred();
                displayCharacter(charMap, dfd)
                return dfd.promise();
            }
        }

        try {
            if (allMethods[options]) {
                return allMethods[options].apply(this, Array.prototype.slice.call(arguments, 1));
            } else if (typeof options === "object" || ! options) {
                return allMethods.init.apply(this, arguments);
            } else {
                throw new $.fn.fallBlatt.exception("Unknown method: " + options);
            }
        } catch (e) {
            console.error(e.error)
        }
    };

    $.fn.fallBlatt.exception = function(error) {
        this.error = "fallBlatt error: " + error;
    }

    $.fn.fallBlatt.defaults = {
        // flapHeight and flapWidth should only be modified if the charset/font is changed!
        // Use the flapScale parameter instead
        flapHeight: 120,
        flapWidth: 90,
        flapScale: 1,
        flapSpacingExtraHeight: 0,
        flapSpacingExtraWidth: 0,
        flapCharset: {
            // Index 0 is the default character (space)
            // If an unknown character is observed, the last char from the list will be used
            chars: " 1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ'‘?’“!”(%)[#]{@}/&\\<-_+÷×=>$€:;,.~*rbgyow",
            options: {
                // "CHAR": [List of classes to attach to this char]
                "(": ["splitFlapCharBrackets"],
                "%": ["splitFlapCharSpecial"],
                ")": ["splitFlapCharBrackets"],
                "[": ["splitFlapCharBrackets"],
                "#": ["splitFlapCharSpecial"],
                "]": ["splitFlapCharBrackets"],
                "{": ["splitFlapCharBrackets"],
                "@": ["splitFlapCharSpecial"],
                "}": ["splitFlapCharBrackets"],
                "/": ["splitFlapCharBrackets"],
                "&": ["splitFlapCharSpecial"],
                "\\": ["splitFlapCharBrackets"],
                "_": ["splitFlapCharExtremes"],
                "$": ["splitFlapCharSpecial"],
                ":": ["splitFlapCharExtremes"],
                ";": ["splitFlapCharExtremes"],
                ",": ["splitFlapCharExtremes"],
                "~": ["splitFlapCharTilde"],
                "*": ["splitFlapCharAsterisk"],
                "r": ["splitFlapCharColourBase", "splitFlapCharColourRed"],
                "b": ["splitFlapCharColourBase", "splitFlapCharColourBlue"],
                "g": ["splitFlapCharColourBase", "splitFlapCharColourGreen"],
                "y": ["splitFlapCharColourBase", "splitFlapCharColourYellow"],
                "o": ["splitFlapCharColourBase", "splitFlapCharColourOrange"],
                "w": ["splitFlapCharColourBase", "splitFlapCharColourWhite"]
            }
        },
        flapCss: {
            flapContainerScaleClass: "splitFlapScaleLayer",
            flapContainerClass: "splitFlapContainer",
            flapContainerDividerBaseClass: "splitFlapContainerDividerBase",
            flapContainerDividerClass: "splitFlapContainerDivider",
            flapContainerDividerLinkLeftClass: "splitFlapContainerDividerLinkLeft",
            flapContainerDividerLinkRightClass: "splitFlapContainerDividerLinkRight",
            flapContainerCharClass: "splitFlapContainerChar"
        }
    }
}( jQuery ));
