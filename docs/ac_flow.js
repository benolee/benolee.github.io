/* ---- BUILT FILE. DO NOT MODIFY THIS DIRECTLY. ---- */


AC.Flow = AC.Class({
	__defaultOptions: {
		fps: 24,
		diffStart: 1,
		benchmark: false
	},
	initialize: function ac_initialize(diff, manifestSrc, keyframe, options) {
		if (!AC.Environment.Feature.supportsCanvas()) {
			this.__publish('degraded');
			return false;
		}
		this.setOptions(options);
		// Set other properties
		this._delegate = {};
		this._canPlay = false;
		this._width = null;
		this._height = null;
		this._loaded = false;
		this._diff = null;
		this._keyframe = null;
		this._framecount = null;
		this._currentFrame = -1;
		// Add synthesizer methods
		AC.Object.synthesize(this);
		// Set private properties
		this.__isPlaying = false;
		this.__blocksPerFullDiff = null;
		this.__columnsInCanvas = null;
		this.__frames = null;
		// Temporarily store diffSrc until we know how many frames there are (which is in the manifest);
		this.__diffSrc = diff;
		// Set the manifest and listen for it to finish loading.
		this.__manifest = new AC.Flow.Manifest(manifestSrc);
		AC.NotificationCenter.subscribe(AC.Flow.notificationPrefix() + 'manifestLoaded', this.__onManifestLoad.bind(this), this.__manifest);
		// Benchmarking with Stats.js
		if (this.options().benchmark === true && typeof Stats !== 'undefined' && !AC.Flow.stats) {
			var statsClassName = 'ac-flow-benchmark-stats';
			var stats = AC.Element.selectAll('.' + statsClassName);
			AC.Flow.stats = new Stats();
			document.body.appendChild(AC.Flow.stats.domElement);
			AC.Element.addClassName(AC.Flow.stats.domElement, statsClassName);
			AC.Flow.stats.domElement.id = statsClassName + '-' + stats.length;
			AC.Flow.stats.domElement.title = keyframe;
			AC.Flow.stats.domElement.style.position = 'fixed';
			AC.Flow.stats.domElement.style.top = 0;
			AC.Flow.stats.domElement.style.left = stats.length * 80 + 'px';
			AC.Flow.stats.domElement.style.zIndex = 10000;
			AC.Flow.stats.setMode(0);
		}
		// Load the keyframe
		this.__loadImage(this.__getKeyframeSrc(keyframe), this.__onDidLoadKeyframe.bind(this));
	},
	play: function ac_play(canvas, options) {
		if (this.__isPlaying === true) {
			return false;
		}
		options = typeof options === 'object' ? options : {};
		this.__doWhenCanPlay(this.__play, [canvas, options]);
	},
	pause: function ac_pause() {
		if (this.__isPlaying === true) {
			this.__isPlaying = false;
			window.clearTimeout(this.__animationTimeout);
			// Publish play event with delegate
			this.__publish('didPause', true);
		}
	},
	showFrame: function ac_showFrame(canvas, frameNumber, reset, img) {
		if (isNaN(frameNumber)) {
			return false;
		}
		// Pause animation if one is happening
		this.pause();
		// If image is defined as a Node, turn it into a string. We need to make a new node to ensure we get the onload event.
		if (AC.Element.isElement(img) && img.tagName.toLowercase() === 'img') {
			img = img.getAttribute('src');
		}
		// If there is an image representing this frame, just show that!
		if (typeof img === 'string') {
			var self = this;
			// Load the image, then show it.
			this.__loadImage(img, function (img) {
				// Set currentFrame to frame we will draw
				self.setCurrentFrame.apply(self, [frameNumber]);
				// Publish notification and delegate
				// self.__publish.apply(self, ['willShowFrame', true]);
				// Show image content
				self.__showImage.apply(self, [canvas, img]);
			});
		// If enough content has loaded to play, then enough has loaded to show the frame
		} else {
			this.__doWhenCanPlay(this.__showFrame, [canvas, frameNumber, reset]);
		}
	},
	setupCanvas: function ac_setupCanvas(canvas, showKeyframe) {
		var context;
		// Canvas can be defined as ID or DOM Node
		canvas = AC.Element.getElementById(canvas);
		// Validate canvas
		if (!AC.Element.isElement(canvas) || canvas.tagName.toLowerCase() !== 'canvas') {
			throw 'Playing a sequence requires a canvas tag to be present.';
		}
		context = canvas.getContext('2d');
		// Show keyframe image data and set canvas dimensions
		if (canvas.getAttribute('width') === null) {
			canvas.setAttribute('width', this.width());
		}
		if (canvas.getAttribute('height') === null) {
			canvas.setAttribute('height', this.height());
		}
		if (showKeyframe === true) {
			this.__showImage(canvas, this.keyframe());
		}
		return context;
	},
	cleanup: function ac_cleanup() {
		// Clear properties
		this.setCanPlay(false);
		this.setLoaded(false);
		this.setKeyframe(null);
		this._diff = null;
		this.__diffSrcs = null;
		this.__frames = null;
		this.__manifest = null;
	}
});
AC.Flow.version = '1.0';
if (typeof document !== 'undefined') {
	document.createElement('canvas');
}
AC.Flow.createHighBitNumber = function (highOrderByte, lowOrderByte) {
	return (highOrderByte << 8) + lowOrderByte;
};
AC.Flow.valueForCharAt = function (str, location) {
	var code = str.charCodeAt(location);
	// A-Z
	if (code > 64 && code < 91) {
		return code - 65;
	}
	// a-z
	if (code > 96 && code < 123) {
		return code - 71;
	}
	// 0-9
	if (code > 47 && code < 58) {
		return code + 4;
	}
	// +
	if (code === 43) {
		return 62;
	}
	// /
	if (code === 47) {
		return 63;
	}
	// huh?
	throw 'Invalid Bas64 character: ' + str.charAt(location);
};
AC.Flow.createNumberFromBase64Range = function (str, location, length) {
	var numberToReturn = 0;
	var currentValue;
	while (length--) {
		currentValue = AC.Flow.valueForCharAt(str, location++);
		numberToReturn += (currentValue << length * 6);
	}
	return numberToReturn;
};
AC.Flow.notificationPrefix = function () {
	return AC.Flow._notificationPrefix;
};
AC.Flow._notificationPrefix = 'ac-flow-';
AC.Object.extend(AC.Flow.prototype, {
	__applyDiff: function ac___applyDiff(context, frame, blockSize, diffImageCount, width, diffs) {
		var i;
		// Keyframe is null
		if (frame) {
			for (i = 0; i < frame.length; i += 1) {
				this.__applyDiffRange(context, frame[i], blockSize, diffImageCount, width, diffs);
			}
		}
	},
	__applyDiffRange: function ac___applyDiffRange(context, range, blockSize, diffImageCount, width, diffs) {
		// Calculate everything we need to place the image data
		var currentBlock = range.block;
		var remainingLength = range.length;
		var diffIndex = Math.floor(currentBlock / this.__blocksPerFullDiff);
		var diffWidth = diffs[diffIndex].width;
		var blockInDiff = currentBlock % this.__blocksPerFullDiff;
		var columnsPerDiff = diffWidth / blockSize;
		var diffX = (blockInDiff % columnsPerDiff) * blockSize;
		var diffY = Math.floor(blockInDiff / (columnsPerDiff || 1)) * blockSize;
		var canvasX = (range.location % this.__columnsInCanvas) * blockSize;
		var canvasY = Math.floor(range.location / this.__columnsInCanvas) * blockSize;
		var blockRunWidth;
		var blockRunCount;
		// We can’t place all the blocks at once if they are not all in the same row on the diff image or the canvas
		// So we need to deal with as many blocks at once as we can until we run out of blocks that need to be placed.
		while (remainingLength) {
			// Smallest value of these numbers is how many blocks we can place from our current block
			// • To total remaining blocks to place in this range * the width of one block
			// • The remaining pixels from our start location on the canvas to the end of the canvas
			// • The remaining pixels from our start location on the diff to the end of the diff
			blockRunWidth = Math.min((remainingLength * blockSize), width - canvasX, diffWidth - diffX);
			// From there we can calculate how many of the blocks we can place at one time
			blockRunCount = blockRunWidth / blockSize;
			// Draw image data to canvas. This is not theoretically rendered on the screen until javascript has finished processing
			// This would be when the setTimeout for the next frame happens
			context.drawImage(diffs[diffIndex], diffX, diffY, blockRunWidth, blockSize, canvasX, canvasY, blockRunWidth, blockSize);
			// Remove the number of blocks that we’re placed from the tally of blocks left to place
			remainingLength -= blockRunCount;
			// If we haven’t finished all our block placement yet, prepare for the next go
			if (remainingLength) {
				// We’re ready to move to the next row if we’ve already placed a row of blocks and have more to go!
				if ((diffX += blockRunWidth) >= diffWidth) {
					diffX = 0;
					diffY += blockSize;
				}
				// If we’ve reached the end of the diffImage, we need to move onto the next one.
				if ((blockInDiff += blockRunCount) >= this.__blocksPerFullDiff) {
					// Reset to 0 and increment the image number
					blockInDiff = 0;
					diffX = 0;
					diffY = 0;
					diffIndex += 1;
					// Last diff image can be a smaller size
					if (diffIndex === diffImageCount - 1) {
						diffWidth = diffs[diffIndex].width;
					}
				}
				// Move the canvas location if we’ve drawn to the end of the canvas
				if ((canvasX += blockRunWidth) >= width) {
					canvasX = 0;
					canvasY += blockSize;
				}
				// Move our temporary current block cursor to the next block in our range
				currentBlock += blockRunCount;
			}
		}
	}
});
AC.Object.extend(AC.Flow.prototype, {
	__diffImageLoaded: function ac___diffImageLoaded() {
		if (isNaN(this.__diffLoadedCount)) {
			this.__diffLoadedCount = 0;
		}
		this.__diffLoadedCount += 1;
		if (this.__diffLoadedCount === this.__manifest.diffImageCount()) {
			this.__onDiffLoaded();
			// Flag that we’re loaded
			this.setLoaded(true);
			// Publish notification and delegate
			this.__publish('didLoad', true);
			// Test to see if we can play now
			this.__canPlay();
			delete this.__diffLoadedCount;
		}
	},
	__frameStringFromNumber: function ac___frameStringFromNumber(i, numberOfDigits) {
		var frameNumber = i + '';
		while (frameNumber.length < numberOfDigits) {
			frameNumber = '0' + frameNumber;
		}
		return frameNumber;
	},
	setDiff: function ac_setDiff(diff) {
		if (this._diff !== null) {
			throw 'Diff cannot be set more than once';
		}
		var imagePathParts = diff.match(/^([^#]*)(#+)([^#]*)$/);
		var i;
		var imagePath;
		var loadedCount = 0;
		var __diffImageLoaded = this.__diffImageLoaded.bind(this);
		this._diff = [];
		this.__diffSrcs = [];
		// Add the src of each diff image to list
		for (i = this.options().diffStart; i <= (this.__manifest.diffImageCount() + (this.options().diffStart - 1)); i += 1) {
			// Construct path
			imagePath = imagePathParts[1] + this.__frameStringFromNumber(i, imagePathParts[2].length) + imagePathParts[3];
			// Add this string to the diff array
			this.__diffSrcs.push(imagePath);
			// Preload image
			this._diff.push(this.__loadImage(imagePath, __diffImageLoaded));
		}
	}
});
AC.namespace('AC.Flow.SharedMethods');
AC.Flow.SharedMethods.setOptions = function (options) {
	if (typeof this._options !== 'undefined') {
		throw 'Options cannot be set more than once';
	}
	// Empty object created by clone if this.__defaultOptions is undefined
	var defaultOptions = AC.Object.clone(this.__defaultOptions);
	// Validate and set options
	if (typeof options === 'object') {
		this._options = AC.Object.extend(defaultOptions, options);
	} else {
		this._options = defaultOptions;
	}
};
AC.Flow.SharedMethods.__publish = function (event, delegate, data) {
	data = typeof data === 'undefined' ? this : data;
	//try { console.log('Published: ' + event); } catch (e) {}
	// Publish notification
	AC.NotificationCenter.publish(AC.Flow.notificationPrefix() + event, {
		target: this,
		data: data
	}, true);
	// Run delegate, if there is one for this event and one has been defined on this instance
	var delegateEvent = 'on' + event.slice(0, 1).toUpperCase() + event.slice(1, event.length);
	if (delegate === true && typeof this.delegate()[delegateEvent] === 'function') {
		this.delegate()[delegateEvent](data);
	}
};
AC.Flow.SharedMethods.__doWhenCanPlay = function (func, args) {
	if (this.canPlay()) {
		func.apply(this, args);
	// If we can’t play yet, then wait and listen to the can-play notification
	} else {
		var self = this;
		var doIt = function (data) {
			// Make sure target is correct instance before playing
			func.apply(self, args);
		};
		// If we can’t play yet, wait until we can.
		AC.NotificationCenter.subscribe(AC.Flow.notificationPrefix() + 'canPlay', doIt, this);
	}
};
AC.Flow.SharedMethods.__setupContainer = function () {
	if (typeof this.setContext !== 'function') {
		this._context = null;
	}
	if (typeof this.setCanvas !== 'function') {
		this._context = null;
	}
	AC.Object.synthesize(this);
	// Clear container
	this.container().innerHTML = '';
	// If the container is a canvas tag, use it as the canvas
	if (this.container().tagName.toLowerCase() === 'canvas') {
		this.setCanvas(this.container());
	} else {
		this.setCanvas(document.createElement('canvas'));
		this.container().appendChild(this.canvas());
	}
	// Memoize the context
	this.setContext(this.canvas().getContext('2d'));
};
AC.Flow.SharedMethods.benchmarkStart = function () {
	if (AC.Flow.stats) {
		if (AC.Flow.stats.__isCounting) {
			AC.Flow.stats.end();
		}
		AC.Flow.stats.begin();
		AC.Flow.stats.__isCounting = true;
	}
};
AC.Flow.SharedMethods.benchmarkEnd = function () {
	if (AC.Flow.stats) {
		if (AC.Flow.stats.__isCounting) {
			AC.Flow.stats.end();
		}
		AC.Flow.stats.__isCounting = false;
	}
};
AC.Object.extend(AC.Flow.prototype, {
	__onDiffLoaded: function ac___onDiffLoaded() {
		// No. of columns * (height of diff divided by size of each block);
		// Only the last diff image can have a different amount of blocks
		this.__blocksPerFullDiff = (this.diff()[0].width / this.__manifest.size()) * (this.diff()[0].height / this.__manifest.size());
	},
	__onDidLoadKeyframe: function ac___onDidLoadKeyframe(img) {
		// Store keyframe node
		this.setKeyframe(img);
		this.setWidth(img.width);
		this.setHeight(img.height);
		this.__publish('didLoadKeyframe', true);
		// Let canPlay method test whether we can play yet
		this.__canPlay();
	},
	__onManifestLoad: function ac___onManifestLoad() {
		this.setDiff(this.__diffSrc);
		delete this.__diffSrc;
		// Proxy frame count to expose it publically
		// Add 1 to account for keyframe
		this.setFramecount(this.__manifest.framecount() + 1);
		// Store diffs in an array that accounts for keyframe at position 0
		this.__frames = [null].concat(this.__manifest.frames());
		// Let canPlay method test whether we can play yet
		this.__canPlay();
	},
	__onBeforeCanPlay: function ac___onBeforeCanPlay() {
		// Now we have enough info to determine the column count for the canvas
		this.__columnsInCanvas = this.width() / this.__manifest.size();
	},
	__publish: AC.Flow.SharedMethods.__publish
});
AC.Object.extend(AC.Flow.prototype, {
	__play: function ac___play(canvas, options) {
		var self = this;
		var framecount = this.framecount();
		// Use default fps if none is provided
		options.fps = !isNaN(options.fps) ? options.fps : this.options().fps;
		options.toFrame = !isNaN(options.toFrame) && options.toFrame >= 0 && options.toFrame < framecount ? options.toFrame : framecount - 1;
		var timePerFrame = 1000 / options.fps;
		var context = this.setupCanvas(canvas, false);
		//var nextFrame = this.currentFrame() - 1;
		var nextFrame = this.currentFrame();
		var endFrame = (options.continuous === true) ? Infinity : options.toFrame;
		// If we need to play to a frame that is <= currentFrame
		var loopOnce = (endFrame <= this.currentFrame());
		// Store locally for efficiency
		var blockSize = this.__manifest.size();
		var diffImageCount = this.__manifest.diffImageCount();
		var width = this.width();
		var diffs = this.diff();
		this.__isPlaying = true;
		// Publish play event with delegate
		this.__publish('willPlay', true);
		var renderFrame = function () {
			var renderTimer = new Date();
			nextFrame += 1;
			// Benchmarking
			AC.Flow.SharedMethods.benchmarkStart();
			// Current frame is null for keyframe because there are no diffs to apply
			if (self.__frames[nextFrame]) {
				self.__applyDiff.apply(self, [context, self.__frames[nextFrame], blockSize, diffImageCount, width, diffs]);
				// After this point, nextFrame is the current frame showing!
				// Publish notification and delegate
				// self.__publish.apply(self, ['willShowFrame', true]);
			} else {
				self.__showImage(canvas, self.keyframe());
			}
			// If we’re not on the last frame or we are continuously playing, and we haven’t been told to stop
			if ((nextFrame < endFrame || loopOnce === true) && self.__isPlaying === true) {
				if (nextFrame >= (framecount - 1)) {
					loopOnce = false;
					self.__publish('didPlay', true);
					// Reset current frame for continuous play
					self.__reset();
					nextFrame = -1;
				} else {
					// Increment current frame
					self.setCurrentFrame(nextFrame);
				}
				self.__animationTimeout = window.setTimeout(renderFrame, Math.max(timePerFrame - (new Date() - renderTimer), 10));
			// When we’re ready to stop playing
			} else {
				// Benchmark
				if (AC.Flow.stats) {
					var benchmark = ((new Date() - AC.Flow.stats.__benchmarkTimer));
					var benchmarkDiff = benchmark - (timePerFrame * framecount);
					var consoleMethod = benchmarkDiff > 200 ? 'warn' : 'log';
					try { console[consoleMethod]('Benchmark: ' + (benchmarkDiff >= 0 ? '+' : '') + (benchmarkDiff / 1000)); } catch (e) {}
					AC.Flow.stats.__isCounting = false;
				}
				self.__isPlaying = false;
				self.setCurrentFrame(nextFrame);
				// Publish notification and delegate
				self.__publish('didPlay', true);
			}
		};
		// Benchmark
		if (AC.Flow.stats) {
			AC.Flow.stats.__benchmarkTimer = new Date();
		}
		this.__animationTimeout = window.setTimeout(renderFrame, timePerFrame);
	},
	__reset: function ac___reset() {
		// Reset current frame to 0
		this.setCurrentFrame(0);
	},
	__showFrame: function ac___showFrame(canvas, frameNumber, reset) {
		var context;
		var i;
		// Store locally for efficiency
		var blockSize = this.__manifest.size();
		var diffImageCount = this.__manifest.diffImageCount();
		var width = this.width();
		var diffs = this.diff();
		// If we need to reset to get to this keyframe
		if (frameNumber <= this.currentFrame() || reset === true) {
			// Reset to first frame
			this.__reset();
			// Reset canvas to keyframe
			context = this.setupCanvas(canvas, true);
		} else {
			// If we’re not on frame 0, then we don’t want to draw the current frame
			if (this.currentFrame() !== 0) {
				this.setCurrentFrame(this.currentFrame() + 1);
			}
			// No need to reset since we’re only going forward
			context = this.setupCanvas(canvas);
		}
		// Loop over all frames until we get to the one we want to show. Doesn’t render until all diffs have been applied.
		for (i = this.currentFrame(); i <= Math.min(frameNumber, this.__frames.length - 1); i += 1) {
			this.__applyDiff(context, this.__frames[i], blockSize, diffImageCount, width, diffs);
		}
		// Update currentFrame
		this.setCurrentFrame(frameNumber);
		// Publish notification and delegate
		// this.__publish('willShowFrame', true);
	},
	__loadImage: function ac___loadImage(src, onload) {
		// Create new Image node. If asset is cached, onLoad is still asynchronous, but happens almost immediately.
		var img = new Image();
		// Onload, run callback and pass it the Image node.
		img.onload = function () {
			if (typeof onload === 'function') {
				onload(img);
			}
		};
		// Warn if we have an issue with getting this image
		img.onerror = function (err) {
			throw 'Image not found: ' + src;
		};
		// Load the image
		img.src = src;
		return img;
	},
	__showImage: function ac___showImage(canvas, img) {
		var context;
		canvas = AC.Element.getElementById(canvas);
		context = canvas.getContext('2d');
		if (canvas.getAttribute('width') === null) {
			canvas.setAttribute('width', img.width);
		}
		if (canvas.getAttribute('height') === null) {
			canvas.setAttribute('height', img.height);
		}
		context.drawImage(img, 0, 0);
	},
	__getKeyframeSrc: function ac___getKeyframeSrc(keyframe) {
		if (AC.Element.isElement(keyframe) && keyframe.tagName.toLowerCase() === 'img') {
			keyframe = keyframe.getAttribute('src');
		}
		if (typeof keyframe !== 'string' || keyframe === '') {
			throw 'Keyframe provided is not valid IMG tag or src string.';
		}
		return keyframe;
	},
	__canPlay: function ac___canPlay() {
		// Only publish notification once
		if (this.canPlay() !== true) {
			if (
				(this.__manifest.loaded() === true) && (this.keyframe() !== null) && (this.loaded() === true)
			) {
				this.__onBeforeCanPlay();
				this.setCanPlay(true);
				// Publish notification
				this.__publish('canPlay', true);
				return true;
			}
			return false;
		}
		return true;
	},
	__doWhenCanPlay: AC.Flow.SharedMethods.__doWhenCanPlay,
	setOptions: AC.Flow.SharedMethods.setOptions
});
AC.Flow.Ambient = AC.Class();
AC.Flow.Ambient.prototype = {
	__defaultOptions: {
		autoplay: true,
		cleanup: true,
		endState: null
	},
	initialize: function ac_initialize(container, diff, manifestSrc, keyframe, options) {
		if (!AC.Environment.Feature.supportsCanvas()) {
			return false;
		}
		this.setOptions(options);
		// Set other properties
		this._delegate = {};
		this._container = AC.Element.getElementById(container);
		this._canvas = null;
		this._context = null;
		// Add synthesizer methods
		AC.Object.synthesize(this);
		// Validate container is valid
		if (!AC.Element.isElement(this.container())) {
			throw 'Valid Element required for playing Ambient Sequence.';
		}
		// Keyframe can be the first IMG element in container if not defined as string
		if (!keyframe) {
			keyframe = AC.Element.select('img', this.container());
		}
		// Set up the container, the canvas, and the context
		this.__setupContainer();
		// Set up the container, the canvas, and the context
		this.__setupSequence(diff, manifestSrc, keyframe);
	},
	play: function ac_play(options) {
		this.__sequence.play(this.canvas(), options);
	},
	cleanup: function ac_cleanup() {
		// Clear properties
		this.setContainer(null);
		this.setCanvas(null);
		this.setContext(null);
		this.__endState = null;
		// Public method for playing should now do nothing
		this.play = AC.Function.emptyFunction;
		// Make flow clean itself up
		this.__sequence.cleanup();
	}
};
AC.Object.extend(AC.Flow.Ambient.prototype, {
	onDidLoadKeyframe: function ac_onDidLoadKeyframe(flow) {
		flow.setupCanvas(this.canvas(), true);
	},
	onCanPlay: function ac_onCanPlay(flow) {
		// Preload endState if all other images have loaded
		// Save node for use on end
		if (typeof this.options().endState === 'string') {
			this.__preloadEndState();
		}
		this.__publish('canPlay', true);
	},
	onWillPlay: function ac_onWillPlay(flow) {
		this.__publish('willPlay', true);
	},
	onDidPlay: function ac_onDidPlay(flow) {
		if (typeof this.options().endState === 'string') {
			var self = this;
			var showEndState = function () {
				self.context().drawImage(self.__endState, 0, 0, self.__sequence.width(), self.__sequence.height());
			};
			// If it is already loaded, show it
			if (this.__endState) {
				showEndState();
			// Otherwise, preload, then show
			} else {
				this.__preloadEndState(showEndState);
			}
		}
		this.__publish('didPlay', true);
		if (this.options().cleanup) {
			this.cleanup();
		}
	}
});
AC.Object.extend(AC.Flow.Ambient.prototype, {
	__setupSequence: function ac___setupSequence(diff, manifestSrc, keyframe) {
		// Set private properties
		this.__sequence = new AC.Flow(diff, manifestSrc, keyframe, this.options());
		// Set delegate of sequence to this
		this.__sequence.setDelegate(this);
		if (this.options().autoplay === true) {
			this.__sequence.play(this.canvas());
		}
	},
	__preloadEndState: function ac___preloadEndState(callback) {
		if (this.__preloadedEndState) {
			return;
		}
		var self = this;
		var img = new Image();
		// Replace endstate with 2x asset
		if (AC.Retina.sharedInstance().shouldReplace('img-tag') && typeof this.__replacedEndstateWith2x === 'undefined') {
			var endstate = this.options().endState.replace(/(\.[a-z]{3})/, '_2x$1');
			// Make sure it exists before we try to use it
			AC.Ajax.checkURL(endstate, function (exists) {
				self.__replacedEndstateWith2x = exists;
				if (exists === true) {
					self.options().endState = endstate;
				}
				self.__preloadEndState.call(self, callback);
			});
		} else {
			img.onload = function () {
				self.__endState = img;
				if (typeof callback === 'function') {
					callback(img);
				}
			};
			img.src = this.options().endState;
			this.__preloadedEndState = true;
		}
	},
	__setupContainer: AC.Flow.SharedMethods.__setupContainer,
	__publish: AC.Flow.SharedMethods.__publish,
	setOptions: AC.Flow.SharedMethods.setOptions
});
AC.Flow.BiDirectional = AC.Class({
	__defaultOptions: {
	},
	initialize: function ac_initialize(forwards, backwards, options) {
		if (!AC.Environment.Feature.supportsCanvas()) {
			return false;
		}
		this.setOptions(options);
		this._forwards = forwards;
		this._backwards = backwards;
		// Set up other properties
		this._delegate = {};
		this._canPlay = false;
		this._currentFlow = forwards;
		this._playing = false;
		// Synthesize getters and setters
		AC.Object.synthesize(this);
		// BiDirectional Flow needs to be the delegate for both individual flows.
		this.forwards().setDelegate(this);
		this.backwards().setDelegate(this);
		this.__sync();
		// Listen for both sequences being ready to play
		var __canPlay = this.__canPlay.bind(this);
		AC.NotificationCenter.subscribe(AC.Flow.notificationPrefix() + 'canPlay', __canPlay, this.forwards());
		AC.NotificationCenter.subscribe(AC.Flow.notificationPrefix() + 'canPlay', __canPlay, this.backwards());
	},
	play: function ac_play(canvas, options) {
		if (this.playing() === true) {
			return false;
		}
		this.__doWhenCanPlay(this.__play, [canvas, options]);
	},
	pause: function ac_pause() {
		if (this.playing() === true) {
			this.currentFlow().pause();
			this.setPlaying(false);
			this.__sync();
		}
	},
	showFrame: function ac_showFrame(canvas, relativeFrameNumber, reset, img) {
		// Pause animation if one is happening
		this.pause();
		this.__doWhenCanPlay(this.__showFrame, [canvas, relativeFrameNumber, reset, img]);
	}
});
AC.Object.extend(AC.Flow.BiDirectional.prototype, {
	onWillPlay: function ac_onWillPlay(flow) {
		this.__publish('willPlay', true);
	},
	onDidPause: function ac_onDidPause(flow) {
		this.__publish('didPause', true);
	},
	onDidPlay: function ac_onDidPlay(flow) {
		this.setPlaying(false);
		this.__sync();
		this.__publish('didPlay', true);
	}
});
AC.Object.extend(AC.Flow.BiDirectional.prototype, {
	__play: function ac___play(canvas, options) {
		// Pick which flow we want to play
		var flow = (options.direction < 0) ? this.backwards() : this.forwards();
		this.setCurrentFlow(flow);
		if (typeof options.toFrame !== 'undefined' && this.currentFlow() === this.backwards()) {
			options.toFrame = (this.currentFlow().framecount() - 1) - options.toFrame;
		}
		// Play that flow
		flow.play(canvas, options);
		this.setPlaying(true);
	},
	__showFrame: function ac___showFrame(canvas, relativeFrameNumber, reset, img) {
		var flow;
		// Determine frame deltas for relativeFrameNumber
		var deltaForwards = this.__determineRelativeDeltaForwards(relativeFrameNumber);
		var deltaBackwards = this.__determineRelativeDeltaBackwards(relativeFrameNumber);
		// Pick which flow makes the most sense
		if (typeof img === 'string') {
			flow = this.forwards();
		} else {
			flow = this.__chooseFlowByDelta(deltaForwards, deltaBackwards);
		}
		// Figure out actual frame we need to go to in selected flow
		var frameNumber = (flow === this.forwards()) ? relativeFrameNumber : ((this.currentFlow().framecount() - 1) - relativeFrameNumber);
		// Pause if we’re playing
		if (this.playing() === true) {
			this.pause();
		}
		// Pass arguments to appropriate flow.
		flow.showFrame(canvas, frameNumber, reset, img);
		// Sync up
		this.__sync();
	},
	__sync: function ac___sync() {
		var sourceFlow;
		var destinationFlow;
		var destinationFrameNumber;
		// Sync this.backwards() with this.forwards()
		if (this.currentFlow() === this.forwards()) {
			sourceFlow = this.forwards();
			destinationFlow = this.backwards();
		// Sync this.forwards() with this.backwards()
		} else {
			sourceFlow = this.backwards();
			destinationFlow = this.forwards();
		}
		// Set the current frame of the destinationFlow to the inverse of the sourceFlow
		destinationFrameNumber = (destinationFlow.framecount() - 1) - sourceFlow.currentFrame();
		destinationFlow.setCurrentFrame(destinationFrameNumber);
	},
	__determineRelativeDeltaForwards: function ac___determineRelativeDeltaForwards(relativeFrameNumber) {
		var delta = relativeFrameNumber - this.forwards().currentFrame();
		// If it’s negative, we’d have to reset anyway
		if (delta < 0) {
			delta = relativeFrameNumber;
		}
		return delta;
	},
	__determineRelativeDeltaBackwards: function ac___determineRelativeDeltaBackwards(relativeFrameNumber) {
		var delta = ((this.backwards().framecount() - 1) - relativeFrameNumber) - this.backwards().currentFrame();
		// If it’s negative, we’d have to reset anyway
		if (delta < 0) {
			delta = ((this.backwards().framecount() - 1) - relativeFrameNumber);
		}
		return delta;
	},
	__chooseFlowByDelta: function ac___chooseFlowByDelta(deltaForwards, deltaBackwards) {
		// If moving forwards is less distance than moving backwards
		if (Math.abs(deltaForwards) <= Math.abs(deltaBackwards)) {
			this.setCurrentFlow(this.forwards());
		// If moving backwards is less distance than moving forwards
		} else {
			this.setCurrentFlow(this.backwards());
		}
		// try { console.log(deltaForwards, deltaBackwards); } catch (e) {}
		// try { console.log(this.currentFlow() === this.forwards() ? 'forwards' : 'backwards'); } catch (e) {}
		return this.currentFlow();
	},
	__canPlay: function ac___canPlay() {
		if (this.canPlay() === true) {
			return true;
		} else if (this.forwards().canPlay() && this.backwards().canPlay()) {
			// Memoize canPlay
			this.setCanPlay(true);
			// Publish notification
			this.__publish('canPlay', true);
			return true;
		}
		return false;
	},
	__doWhenCanPlay: AC.Flow.SharedMethods.__doWhenCanPlay,
	__publish: AC.Flow.SharedMethods.__publish,
	setOptions: AC.Flow.SharedMethods.setOptions
});
AC.Flow.Manifest = AC.Class({
	initialize: function ac_initialize(manifestSrc) {
		if (!AC.Environment.Feature.supportsCanvas()) {
			return false;
		}
		// Define properties
		this._diffImageCount = null;
		this._framecount = null;
		this._frames = [];
		this._key = null;
		this._loaded = false;
		this._size = null;
		this._version = null;
		// Add synthesizer methods
		AC.Object.synthesize(this);
		// Get data from file and parse it into the manifest
		this.__loadManifest(manifestSrc);
	},
	__loadManifest: function ac___loadManifest(manifestSrc) {
		// Loading image data as manifest
		if (manifestSrc.match(/\.png((#|\?).*)?$/)) {
			this.__loadManifestImage(manifestSrc);
		// Load JSON data as manifest
		} else {
			this.__loadManifestJSON(manifestSrc);
		}
	},
	__loadManifestJSON: function ac___loadManifestJSON(manifestSrc) {
		var parseData = this.__parseData.bind(this);
		var self = this;
		// Strip hostname from the manifest src
		manifestSrc = manifestSrc.replace(/^https?:\/\/[^\/]+\//i, '/');
		var ajaxRequest = new AC.Ajax.AjaxRequest(manifestSrc, {
			onSuccess: function ac_onSuccess(response) {
				parseData(response);
				self.__storeBlockLocations.call(self);
			},
			onFailure: function ac_onFailure() {
				throw 'Manifest file not found at ' + manifestSrc;
			},
			onError: function ac_onError() {
				throw 'Error loading JSON file at ' + manifestSrc;
			}
		});
	},
	__parseData: function ac___parseData(response) {
		// Memoize binding readFrame context to this.
		if (typeof this.__boundReadFrame !== 'function') {
			this.__boundReadFrame = this.__readFrame.bind(this);
		}
		// Pixel data
		if (!isNaN(response)) {
			this.__setKeyFromPixelData.apply(this, arguments);
		// Manifest returned from JSON call
		} else if (typeof response === 'object' && typeof response.responseJSON === 'function') {
			response = response.responseJSON();
			this.__setKeyFromJSONData(response);
		}
		if (typeof this.key() === 'object' && typeof this.key().parseData === 'function') {
			this.key().parseData.apply(this, arguments);
		}
	},
	__setKeyFromJSONData: function ac___setKeyFromJSONData(response) {
		// Requires that property 'version' exists on response object
		if (typeof response.version !== 'undefined') {
			this.setVersion(response.version);
		} else {
			throw 'JSON Manifest requires property ‘version’ to be defined.';
		}
		// Assign key to decipher this version of Manifest
		this.setKey(AC.Flow.Manifest.Keys[this.version()]);
	},
	__readHeader: function ac___readHeader(pixels) {
		// Let’s parse the header data
		this.key().parseHeader.call(this, pixels);
		// Flag that the header has been read so that we can move on to our diff data
		this.__headerRead = true;
	},
	__readFrame: function ac___readFrame(pixels) {
		// Let’s parse the pixel data
		this.key().parseFrame.call(this, pixels);
	},
	__storeBlockLocations: function ac___storeBlockLocations() {
		var currentBlock = 0;
		var frames = this.frames();
		var i;
		var ii;
		for (i = 0; i < frames.length; i += 1) {
			for (ii = 0; ii < frames[i].length; ii += 1) {
				// frames[i][ii] is current range
				frames[i][ii].block = currentBlock;
				currentBlock += frames[i][ii].length;
			}
		}
	},
	setKey: function ac_setKey(key) {
		// Validate Version is compatible
		if (typeof key === 'object' && typeof key.parseData === 'function') {
			this._key = key;
		} else {
			throw 'Manifest Version ' + this.version() + ' not understood by this version of AC.Flow.Manifest.';
		}
	},
	setLoaded: function ac_setLoaded(isLoaded) {
		if (this._loaded) {
			throw 'Already loaded manifest! Cannot load it twice.';
		}
		this._loaded = !!isLoaded;
		if (this._loaded) {
			AC.NotificationCenter.publish(AC.Flow.notificationPrefix() + 'manifestLoaded', {
				target: this,
				data: this
			}, true);
		}
	}
});
AC.Object.extend(AC.Flow.Manifest.prototype, {
	__loadManifestImage: function ac___loadManifestImage(manifestSrc) {
		var parseData = this.__parseData.bind(this);
		var self = this;
		AC.Canvas.imageDataFromFile(manifestSrc, function (data) {
			// Save number of pixels in the manifest so we know when we’ve parsed it all
			self.__pixelCount = data.data.length / 4;
			AC.Canvas.iterateImageData(data, parseData);
			self.__storeBlockLocations.call(self);
		});
	},
	__setKeyFromPixelData: function ac___setKeyFromPixelData(r, g, b, a, i) {
		// Get version number, then parse
		if (i === 0) {
			// Assume value for r in first pixel is version number
			this.setVersion(r);
			// Assign key to decipher this version of Manifest
			this.setKey(AC.Flow.Manifest.Keys[this.version()]);
		}
	},
	__readUntilNextMarker: function ac___readUntilNextMarker(data, parser) {
		// Store data in temporary array
		if (!Array.isArray(this.__temporaryData)) {
			this.__temporaryData = [];
		}
		// If the current data is a marker, then we’re read to parse this data
		if (this.key().isMarker.call(this, data)) {
			// Let’s parse the header data that we’ve stored
			parser(this.__temporaryData);
			// Cleanup
			delete this.__temporaryData;
		} else {
			// If this data isn’t a marker, then let’s save this data to be
			// interpretted by the parser for this manifest version’s key
			this.__temporaryData.push(data);
		}
	}
});
AC.Flow.Manifest.Keys = {};
// AC.Flow.Manifest.Keys[1] = {
// 	
// 	parseData: function ac_parseData(r, g, b, a, i) {
// 		// Read the header if we haven’t already
// 		if (this.__headerRead !== true) {
// 			this.__readUntilNextMarker(arguments, this.__readHeader.bind(this));
// 		// Otherwise we’re onto the frames!
// 		} else {
// 			// Ignore extra markers at the end. They aren’t real frames.
// 			if (this.frames().length < this.framecount()) {
// 				this.__readUntilNextMarker([r, g, b, a], this.__boundReadFrame);
// 			}
// 		}
// 		// Manifest has been completely parsed
// 		// Assume there is always at least one marker at the end of the imageData.
// 		if (i >= this.__pixelCount - 1) {
// 			this.setLoaded(true);
// 		}
// 	},
// 	*
// 		@inner
// 		@returns {Boolean} whether this pixel is a marker
// 	isMarker: function ac_isMarker(pixel) {
// 		// If r, g, and b are all 0
// 		return (pixel[0] === 0 && pixel[1] === 0 && pixel[2] === 0);
// 	},
// 	
// 	parseHeader: function ac_parseHeader(pixels) {
// 		// Framecount is pixel 0, high bit number from g and b values.
// 		this.setFramecount(AC.Flow.createHighBitNumber(pixels[0][1], pixels[0][2]));
// 		// Size is pixel 1, r value.
// 		this.setSize(pixels[1][0]);
// 		// Diff Image Count is pixel 1, g value.
// 		this.setDiffImageCount(pixels[1][1]);
// 	},
// 	
// 	parseFrame: function ac_parseFrame(pixels) {
// 		var frame = [];
// 		var i;
// 		// Parse each range that comprises this frame
// 		for (i = 0; i < pixels.length; i += 1) {
// 			// Add an Object that defines the length and location of the range
// 			frame.push({
// 				// Location is high bit number from r and g values
// 				location: AC.Flow.createHighBitNumber(pixels[i][0], pixels[i][1]),
// 				// Lenth is b value
// 				length: pixels[i][2]
// 			});
// 		}
// 		// Add this frame’s range data to the list of frames
// 		this.frames().push(frame);
// 	}
// };
AC.Flow.Manifest.Keys[2] = {
	parseData: function ac_parseData(data) {
		var i;
		this.__readHeader(data);
		for (i = 0; i < data.frames.length; i += 1) {
			this.__readFrame(data.frames[i]);
		}
		this.setLoaded(true);
	},
	parseHeader: function ac_parseHeader(data) {
		this.setFramecount(data.frameCount);
		this.setSize(data.blockSize);
		this.setDiffImageCount(data.imagesRequired);
	},
	parseFrame: function ac_parseFrame(range) {
		var frame = [];
		var i;
		// Parse each range that comprises this frame
		for (i = 0; i < range.length; i += 5) {
			//Add an Object that defines the length and location of the range
			frame.push({
				// Location is first 3 characters
				location: AC.Flow.createNumberFromBase64Range(range, i, 3),
				// Lenth is second 2 characters
				length: AC.Flow.createNumberFromBase64Range(range, i + 3, 2)
			});
		}
		// Add this frame’s range data to the list of frames
		this.frames().push(frame);
	}
};
AC.Flow.VR = AC.Class({
	__defaultOptions: {
		extension: 'jpg',
		autoplay: true,
		autoplayDirection: 1,
		continuous: true,
		scrubbable: true,
		scrubRotateDistance: 1000,
		scrubDirection: -1,
		scrubHeartbeat: 0.04,
		playOnScrubEnd: false,
		throwable: true,
		minThrowDuration: 0.5,
		maxThrowDuration: 1.5,
		stopEventThreshold: 10
	},
	initialize: function ac_initialize(container, path, options) {
		this.setOptions(options);
		// Set other properties
		this._delegate = {};
		this._container = AC.Element.getElementById(container);
		this._canvas = null;
		this._context = null;
		this._scrubbing = false;
		this._throwing = false;
		this._flow = null;
		// Add synthesizer methods
		AC.Object.synthesize(this);
		if (AC.Environment.Feature.supportsCanvas()) {
			// Mutually exclusive options
			if (this.options().playOnScrubEnd === true) {
				this.options().throwable = false;
			}
			// Validate container is valid
			if (!AC.Element.isElement(this.container())) {
				throw 'Valid Element required for a AC.Flow.VR.';
			}
			// Set up the container, the canvas, and the context
			this.__setupContainer();
			// Set up the container, the canvas, and the context
			this.__setupFlow(path);
			// Autoplay or just show keyframe
			if (this.options().autoplay === true) {
				this.play({ direction: this.options().autoplayDirection, fps: this.options().fps });
			} else {
				this.flow().showFrame(this.canvas(), 0, true);
			}
			if (this.options().scrubbable === true) {
				this.__enableScrubbing();
			}
			if (this.options().throwable === true) {
				this.__minThrowFrames = Math.floor(this.options().minThrowDuration * this.options().fps);
				this.__maxThrowFrames = Math.floor(this.options().maxThrowDuration * this.options().fps);
			}
		}
	},
	play: function ac_play(options) {
		if (this.scrubbing() === false) {
			options = typeof options === 'object' ? options : {};
			options.fps = !isNaN(options.fps) ? options.fps : this.options().fps;
			options.continuous = typeof options.continuous === 'boolean' ? options.continuous : this.options().continuous;
			this.__stopThrowing();
			this.flow().play(this.canvas(), options);
		}
	},
	pause: function ac_pause() {
		this.flow().pause();
	}
});
AC.Object.extend(AC.Flow.VR.prototype, {
	onWillPlay: function ac_onWillPlay(flow) {
		this.__publish('willPlay', true);
	},
	onDidPause: function ac_onDidPause(flow) {
		this.__publish('didPause', true);
	},
	onDidPlay: function ac_onDidPlay(flow) {
		this.__publish('didPlay', true);
	}
});
AC.Object.extend(AC.Flow.VR.prototype, {
	__startHeartbeat: function ac___startHeartbeat() {
		if (typeof this.__boundRunHeartbeat === 'undefined') {
			this.__boundRunHeartbeat = this.__runHeartbeat.bind(this);
		}
		this.__heartbeatFunction = null;
		this.__heartbeat = window.setInterval(this.__boundRunHeartbeat, this.options().scrubHeartbeat * 1000);
	},
	__endHeartbeat: function ac___endHeartbeat() {
		window.clearInterval(this.__heartbeat);
		delete this.__heartbeat;
	},
	__runOnHeartbeat: function ac___runOnHeartbeat(func) {
		this.__heartbeatFunction = func;
	},
	__runHeartbeat: function ac___runHeartbeat() {
		if (typeof this.__heartbeatFunction === 'function') {
			this.__heartbeatFunction.call(this);
		}
		// Clear out heartbeat function
		this.__heartbeatFunction = null;
	}
});
AC.Object.extend(AC.Flow.VR.prototype, {
	__setupFlow: function ac___setupFlow(path) {
		var flow;
		var flowForwards;
		var flowBackwards;
		var manifestExtension = 'json';
		var keyframeExtension = 'jpg';
		// Strip . as first character if applicable
		var extension = this.options().extension.replace(/^(\.)/, '');
		var options = {};
		if (typeof this.options().fps !== 'undefined') {
			options.fps = this.options().fps;
		}
		// Add / as last character if it’s not already
		path = (path.match(/(\/)$/)) ? path : path + '/';
		// Create flows
		flowForwards = new AC.Flow(path + 'forwards_###.' + extension, path + 'forwards_manifest.' + manifestExtension, path + 'forwards_keyframe.' + keyframeExtension, options);
		flowBackwards = new AC.Flow(path + 'backwards_###.' + extension, path + 'backwards_manifest.' + manifestExtension, path + 'backwards_keyframe.' + keyframeExtension, options);
		this.setFlow(new AC.Flow.BiDirectional(flowForwards, flowBackwards));
		this.flow().setDelegate(this);
		if (typeof this.options().fps === 'undefined') {
			this.options().fps = this.flow().forwards().options().fps;
		}
	},
	__getRelativeEvent: function ac___getRelativeEvent(evt) {
		if (evt.touches) {
			// ignore multi-touch
			if (evt.touches.length > 1) {
				return false;
			}
			if (evt.touches.length) {
				evt.clientX = evt.touches[0].clientX;
				evt.clientY = evt.touches[0].clientY;
			}
			if (typeof evt.clientX === 'undefined') {
				evt.clientX = this.__onScrubMove.clientX;
			}
			if (typeof evt.clientY === 'undefined') {
				evt.clientY = this.__onScrubMove.clientY;
			}
		}
		return evt;
	},
	__showFrameFromEvent: function ac___showFrameFromEvent(evt) {
		var frame = this.__getScrubFrame(evt, this.__onScrubStart.frame, this.__onScrubStart.clientX);
		this.__showFrame(frame);
	},
	__showFrame: function ac___showFrame(frame) {
		this.flow().showFrame(this.canvas(), frame);
	},
	__setupContainer: AC.Flow.SharedMethods.__setupContainer,
	__publish: AC.Flow.SharedMethods.__publish,
	setOptions: AC.Flow.SharedMethods.setOptions
});
AC.Object.extend(AC.Flow.VR.prototype, {
	__enableScrubbing: function ac___enableScrubbing() {
		var scrubStart = AC.Function.bindAsEventListener(this.__onScrubStart, this);
		var scrubMove = AC.Function.bindAsEventListener(this.__onScrubMove, this);
		var scrubEnd = AC.Function.bindAsEventListener(this.__onScrubEnd, this);
		// Touch Device
		AC.Element.addEventListener(this.container(), 'touchstart', scrubStart);
		AC.Element.addEventListener(window, 'touchmove', scrubMove);
		AC.Element.addEventListener(window, 'touchend', scrubEnd);
		// Desktop w/ mouse
		AC.Element.addEventListener(this.container(), 'mousedown', scrubStart);
		AC.Element.addEventListener(window, 'mousemove', scrubMove);
		AC.Element.addEventListener(window, 'mouseup', scrubEnd);
		AC.Element.addClassName(this.container(), 'grabbable');
	},
	__onScrubStart: function ac___onScrubStart(evt) {
		if (this.options().scrubbable !== true) {
			return false;
		}
		// Allow pinch/zoom normal behavior.
		if (evt.touches && evt.touches.length > 1) {
			return false;
		}
		if (this.options().stopEventThreshold === false || (!evt.touches && !isNaN(this.options().stopEventThreshold))) {
			AC.Event.stop(evt);
		} else {
			this.__stoppedEvent = false;
		}
		// Cancel throwing animation if we have one playing.
		this.__stopThrowing();
		// Pause animation, store whether or not we were playing
		this.__onScrubStart.playing = this.flow().playing();
		this.pause();
		this.__endHeartbeat();
		// Normalize touch events and mouse events
		evt = this.__getRelativeEvent(evt);
		// Get starting location of grab
		this.__onScrubStart.clientX = evt.clientX;
		this.__onScrubStart.clientY = evt.clientY;
		this.__onScrubStart.frame = this.flow().forwards().currentFrame();
		// Save scrub history for throwing
		this.__updateScrubHistory(evt.clientX);
		this.setScrubbing(true);
		this.__publish('scrubStart', true, [this, [evt.clientX, evt.clientY]]);
	},
	__onScrubMove: function ac___onScrubMove(evt) {
		// Only bother if we’re currently scrubbing
		if (this.scrubbing() !== true) {
			return false;
		}
		// Normalize touch events and mouse events
		evt = this.__getRelativeEvent(evt);
		// save the evt for later
		this.__onScrubMove.clientX = evt.clientX;
		this.__onScrubMove.clientY = evt.clientY;
		// Stop event if we hit threshold
		if (!isNaN(this.options().stopEventThreshold) && Math.abs(this.__onScrubStart.clientX - this.__onScrubMove.clientX) >= this.options().stopEventThreshold) {
			AC.Event.stop(evt);
			this.__stoppedEvent = true;
		}
		// Save scrub history for throwing
		this.__updateScrubHistory(evt.clientX);
		// Save event info in closure so that heartbeat can access it
		var draw = function () {
			// Benchmarking
			AC.Flow.SharedMethods.benchmarkStart();
			this.__showFrameFromEvent(evt);
			this.__publish('scrubMove', true, this.flow().forwards().currentFrame());
		}.bind(this);
		// Use heartbeat for redraw
		if (this.options().scrubHeartbeat && !isNaN(this.options().scrubHeartbeat)) {
			// Start heartbeat, draw frame first
			if (typeof this.__heartbeat === 'undefined') {
				this.__startHeartbeat();
				draw();
			} else {
				this.__runOnHeartbeat(draw);
			}
		// Redraw as quickly as we can
		} else {
			window.requestAnimationFrame(draw);
		}
	},
	__onScrubEnd: function ac___onScrubEnd(evt) {
		// Only bother if we’re currently scrubbing
		if (this.scrubbing() !== true) {
			return false;
		}
		// Normalize touch events and mouse events
		evt = this.__getRelativeEvent(evt);
		if (this.options().scrubHeartbeat && !isNaN(this.options().scrubHeartbeat)) {
			this.__endHeartbeat();
		}
		this.setScrubbing(false);
		// If we didn’t move enough to cancel native scrolling, then we didn’t move enough to cancel animation.
		if (this.__stoppedEvent === false || this.options().playOnScrubEnd === true) {
			this.flow().play(this.canvas());
		} else if (this.options().throwable === true) {
			this.__throw(evt.clientX);
		}
		// Benchmarking
		AC.Flow.SharedMethods.benchmarkEnd();
		this.__publish('scrubEnd', true, [this, [evt.clientX, evt.clientY]]);
	},
	__getScrubFrame: function ac___getScrubFrame(evt, startFrame, startClientX) {
		// Get pixel change from the start position to current position
		var deltaX = evt.clientX - startClientX;
		// Get percentage difference
		var percentDeltaX = deltaX / this.options().scrubRotateDistance;
		// Figure out how many frames we want to travel
		var frameDeltaX = Math.round((this.flow().forwards().framecount() - 1) * percentDeltaX);
		var frame = startFrame + (frameDeltaX * this.options().scrubDirection);
		while (frame < 0) {
			if (this.options().continuous === false) {
				frame = 0;
			} else {
				frame += this.flow().forwards().framecount();
			}
		}
		while (frame >= this.flow().forwards().framecount()) {
			if (this.options().continuous === false) {
				frame = this.flow().forwards().framecount() - 1;
			} else {
				frame -= this.flow().forwards().framecount();
			}
		}
		return frame;
	},
	__updateScrubHistory: function ac___updateScrubHistory(clientX) {
		if (typeof this.__scrubHistory === 'undefined') {
			this.__scrubHistory = [];
		}
		// Add latest to front of array
		this.__scrubHistory.unshift(clientX);
		// Limit to 3
		if (this.__scrubHistory.length > 3) {
			this.__scrubHistory.splice(3);
		}
	},
	setScrubbing: function ac_setScrubbing(value) {
		this._scrubbing = value;
		if (value === true) {
			AC.Element.addClassName(document.body, 'grabbing');
		} else {
			AC.Element.removeClassName(document.body, 'grabbing');
		}
	}
});
AC.Object.extend(AC.Flow.VR.prototype, {
	__throw: function ac___throw(scrubEndClientX) {
		if (!Array.isArray(this.__scrubHistory)) {
			return;
		}
		// Earliest x location from history
		var clientX = this.__scrubHistory[this.__scrubHistory.length - 1];
		// Total distance over last 3 events and end event
		var diffX = scrubEndClientX - clientX;
		// Number of frames to play throw animation over
		var frames = Math.floor(diffX / 5);
		var i;
		var percent;
		var speed;
		var frame;
		if (diffX) {
			// keep # of frames in-bounds
			if (frames < this.__minThrowFrames) {
				frames = this.__minThrowFrames;
			} else if (frames > this.__maxThrowFrames) {
				frames = this.__maxThrowFrames;
			}
			this.__throwSequence = [];
			// Pick a frame to show on the sequence for each frame of the throw animation
			for (i = 0; i < frames; i += 1) {
				percent = i / frames;
				speed = Math.pow(percent - 1, 2);
				clientX = Math.floor(speed * diffX) + clientX;
				frame = this.__getScrubFrame({ clientX: clientX }, this.__onScrubStart.frame, this.__onScrubStart.clientX);
				// once an axis rotates slowly enough to use the same frame number for three frames, stop entirely
				if (this.__throwSequence.length && frame === this.__throwSequence[this.__throwSequence.length - 2]) {
					break;
				}
				this.__throwSequence.push(frame);
			}
			this.setThrowing(true);
			this.__publish('willThrow', true, this.__throwSequence);
			// Go to the first frame in the throw animation
			this.__throwStep();
		}
	},
	__throwStep: function ac___throwStep() {
		if (!this.throwing()) {
			return;
		}
		// Time draw to subtract that from the next timeout
		this.__throwStepTimer = new Date();
		if (typeof this.__boundThrowStep === 'undefined') {
			this.__boundThrowStep = this.__throwStep.bind(this);
		}
		// Benchmarking
		AC.Flow.SharedMethods.benchmarkStart();
		// Render the frame
		this.__showFrame(this.__throwSequence.shift());
		this.__publish('didThrowStep', true, this.__throwSequence);
		// Keep animating if there are more frames
		if (this.__throwSequence.length) {
			window.setTimeout(this.__boundThrowStep, Math.max((1000 / this.options().fps) - (new Date() - this.__throwStepTimer), 10));
		} else {
			// Benchmarking
			AC.Flow.SharedMethods.benchmarkEnd();
			this.__stopThrowing();
		}
	},
	__stopThrowing: function ac___stopThrowing() {
		if (!this.throwing()) {
			return;
		}
		this.setThrowing(false);
		this.__publish('didThrow', true);
		delete this.__scrubHistory;
	}
});
