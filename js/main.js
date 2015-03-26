'use strict';

/* @see https://github.com/isaacs/inherits/blob/master/inherits_browser.js */
var inherits = function(ctor, superCtor) {
	ctor.super_ = superCtor;
	var TempCtor = function() {};
	TempCtor.prototype = superCtor.prototype;
	ctor.prototype = new TempCtor();
	ctor.prototype.constructor = ctor;
};

var SimpleEvents = function() {
	SimpleEvents.init.call(this);
};

SimpleEvents.init = function() {
	this._events = {};
};

SimpleEvents.prototype.addListener = function(type, listener) {
	if (typeof listener !== 'function') {
		throw new TypeError('listener must be a function');
	}

	var self = this;

	if (!self._events[type]) {
		self._events[type] = [];
	}

	self._events[type].push(function() {
		return listener.apply(self, arguments);
	});

	return self;
};

SimpleEvents.prototype.on = SimpleEvents.prototype.addListener;

SimpleEvents.prototype.once = function(type, listener) {
	if (typeof listener !== 'function') {
		throw new TypeError('listener must be a function');
	}

	var fired = false;
	var self = this;

	function g() {
		self.off(type);

		if (!fired) {
			fired = true;
			listener.apply(self, arguments);
		}
	}

	g.listener = listener;
	self.on(type, g);

	return self;
};

SimpleEvents.prototype.off = function(type) {
	var self = this;

	if (!type) {
		self._events = {};
		return self;
	}

	delete self._events[type];
	return self;
};

SimpleEvents.prototype.emit = function(type) {
	var self = this;

	if (!self._events[type]) {
		throw new Error('Event "' + type + '" don\'t exists');
	}

	var args = [].slice.call(arguments, 1);

	for (var i = self._events[type].length - 1; i >= 0; i--) {
		self._events[type][i].apply(self, args);
	}

	return self;
};

var Messenger = (function() {
	var instance;

	Messenger = function(store) {
		if (instance) {
			return instance;
		}

		instance = this;
		instance.store = store;
	};

	return Messenger;
}());

Messenger.prototype.dispatch = function(type) {
	var args = [].slice.call(arguments, 1);
	this.store.emit(type, args[0]);
};


var DragAction = function() {
	SimpleEvents.apply(this, arguments);
};

inherits(DragAction, SimpleEvents);

DragAction.prototype.start = function(messageData) {
	this.emit('start', messageData);
};

DragAction.prototype.stop = function(messageData) {
	this.emit('stop', messageData);
};

DragAction.prototype.moveMain = function(messageData) {
	this.emit('moveMain', messageData);
};

DragAction.prototype.moveMini = function(messageData) {
	this.emit('moveMini', messageData);
};

var DragPosition = function() {
	SimpleEvents.apply(this, arguments);

	this.states = {
		dragH: null,
		dragW: null,
		posY: null,
		posX: null,
		mTop: null,
		mLeft: null
	};
};

inherits(DragPosition, SimpleEvents);

DragPosition.prototype.setState = function(name, value) {
	this.states[name] = value;

	return this;
};

DragPosition.prototype.getState = function(name) {
	return this.states[name];
};

function MinimapPosition(el) {
	var self = this;

	self.x = 0;
	self.y = 0;

	while (el) {
		self.x += (el.offsetLeft - el.scrollLeft + el.clientLeft);
		self.y += (el.offsetTop - el.scrollTop + el.clientTop);
		el = el.offsetParent;
	}
}

/* jshint jquery:true*/

$(function() {
	var $dragTarget = $('#hoge');
	var dragAction = new DragAction();
	var dragPosition = new DragPosition();
	var messenger = new Messenger(dragPosition);

	var $minimap = $dragTarget.clone();
	var $minimapWrap = $('#minimap');
	var $highlight = $('<div></div>');

	var scale = $minimapWrap.height() / $dragTarget.height();
	var posX = $minimapWrap.width() / 2 - $minimapWrap.height() / $dragTarget.height() * $dragTarget.width() / 2;
	var transformStyle = 'scale(' + scale  + ')';
	var minimapleft = posX;

	var offsetStore = $dragTarget.offset();
	var parentPos;

	$minimapWrap
		.html($minimap)
		.append($highlight);

	$minimap
		.attr('id', '')
		.addClass('js-minimap')
		.css({
			'transform-origin': '0 0',
			'-webkit-transform': transformStyle,
			'-moz-transform': transformStyle,
			'-ms-transform': transformStyle,
			'-o-transform': transformStyle,
			'transform': transformStyle,
			'left': minimapleft,
			'position': 'absolute'
		});

	$highlight
		.attr('id', 'js-minimaphighlight')
		.css({
			'width': 710 * scale,
			'height': 452 * scale,
			'position': 'absolute',
			'top': '0',
			'left': minimapleft,
			'background': 'rgba(0,0,0,.4)',
			'border': '1px solid #333'
		});

	parentPos = new MinimapPosition($minimap[0]);

	dragAction
		.on('start', function(result) {
			messenger.dispatch('change', result);
		})
		.on('stop', function(result) {
			messenger.dispatch('complete', result);
		})
		.on('moveMain', function(result) {
			messenger.dispatch('moveMain', result);
		})
		.on('moveMini', function(result) {
			messenger.dispatch('moveMini', result);
		});

	dragPosition
		.on('change', function(result) {
			this
				.setState('dragH', result.dragH)
				.setState('dragW', result.dragW)
				.setState('posY', result.posY)
				.setState('posX', result.posX)
				.setState('mTop', result.mTop)
				.setState('mLeft', result.mLeft);
		})
		.on('moveMain', function(result) {
			var self = this;
			var posX = self.getState('posX');
			var posY = self.getState('posY');

			if (!posX || !posY) {
				return;
			}

			var dragH = self.getState('dragH');
			var dragW = self.getState('dragW');

			result.callback({
				top: result.eY + posY - dragH,
				left: result.eX + posX - dragW
			});
		})
		.on('moveMini', function(result) {
			var self = this;
			var posX = self.getState('posX');
			var posY = self.getState('posY');

			if (!posX || !posY) {
				return;
			}

			var dragH = self.getState('dragH');
			var dragW = self.getState('dragW');

			result.callback({
				top: result.eY + posY - dragH + self.getState('mTop'),
				left: result.eX + posX - dragW + self.getState('mLeft')
			});
		})
		.on('complete', function(result) {
			result.callback();
		});

	$dragTarget
		.bind('mousedown.dragMain touchstart.dragMain', function(e) {
			e.preventDefault();

			setTimeout(function() {
				var dragH = $dragTarget.outerHeight();
				var dragW = $dragTarget.outerWidth();
				var posY = $dragTarget.offset().top + dragH - e.pageY;
				var posX = $dragTarget.offset().left + dragW - e.pageX;

				$dragTarget.addClass('dragMain');

				if (e.originalEvent.changedTouches) {
					posY = $dragTarget.offset().top + dragH - e.originalEvent.changedTouches[0].pageY;
					posX = $dragTarget.offset().left + dragW - e.originalEvent.changedTouches[0].pageX;
				}

				dragAction.start({
					dragH: dragH,
					dragW: dragW,
					posY: posY,
					posX: posX
				});
			}, 4);
		});

	$minimapWrap
		.delegate('#js-minimaphighlight', 'mousedown.dragMini touchstart.dragMini', function(e) {
			e.preventDefault();
			var $this = $(e.currentTarget);

			setTimeout(function() {
				var mTop = e.pageY - parentPos.y - ($highlight.height() / 2);
				var mLeft = e.pageX - parentPos.x - ($highlight.width() / 2);
				var dragH = $this.outerHeight();
				var dragW = $this.outerWidth();
				var posY = dragH - e.pageY;
				var posX = dragW - e.pageX;

				$this.addClass('dragMini');

				if (e.originalEvent.changedTouches) {
					mTop = e.originalEvent.changedTouches[0].pageY - parentPos.y - ($highlight.height() / 2);
					mLeft = e.originalEvent.changedTouches[0].pageX - parentPos.x - ($highlight.width() / 2);
				}

				dragAction.start({
					dragH: dragH,
					dragW: dragW,
					posY: posY,
					posX: posX,
					mTop: mTop,
					mLeft: mLeft
				});
			}, 4);
		})
		.delegate('.js-minimap', 'mousedown touchstart', function(e) {
			var mTop = e.pageY - parentPos.y - ($highlight.height() / 2);
			var mLeft = e.pageX - parentPos.x - ($highlight.width() / 2)

			$highlight.css({
				'margin-top': mTop,
				'margin-left': mLeft
			});

			$dragTarget.offset({
				top: ($highlight.position().top + (offsetStore.top * scale) - mTop) / scale,
				left: offsetStore.left + (mLeft / -scale)
			});
		});

	$('html')
		.bind('mousemove.dragMain touchmove.dragMain', function(e) {
			e.preventDefault();

			var eY, eX;

			if (e.originalEvent.changedTouches) {
				eY = e.originalEvent.changedTouches[0].pageY;
				eX = e.originalEvent.changedTouches[0].pageX;
			} else {
				eY = e.pageY;
				eX = e.pageX;
			}

			dragAction.moveMain({
				eY: eY,
				eX: eX,
				callback: function(pos) {
					setTimeout(function() {
						if ($('.dragMain').length > 0) {
							$highlight.css({
								'margin-top': $highlight.position().top - (pos.top - offsetStore.top) * scale,
								'margin-left': - (pos.left - offsetStore.left) * scale
							});
							$('.dragMain').offset(pos);
						}
					}, 4);
				}
			});

			dragAction.moveMini({
				eY: eY,
				eX: eX,
				callback: function(pos) {
					setTimeout(function() {
						if ($('.dragMini').length > 0) {
							$highlight.css({
								'margin-top': pos.top,
								'margin-left': pos.left
							});
							$dragTarget.offset({
								top: ($highlight.position().top + (offsetStore.top * scale) - pos.top) / scale,
								left: offsetStore.left + (pos.left / -scale)
							});
						}
					}, 4);
				}
			});
		})
		.bind('mouseup.dragMain touchend', function() {
			dragAction.stop({
				callback: function() {
					$dragTarget.removeClass('dragMain');
					$('#js-minimaphighlight').removeClass('dragMini');
				}
			});
		});
});
