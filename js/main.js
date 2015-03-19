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

DragAction.prototype.move = function(messageData) {
	this.emit('move', messageData);
};


var DragPosition = function() {
  SimpleEvents.apply(this, arguments);

  this.states = {};
};

inherits(DragPosition, SimpleEvents);

DragPosition.prototype.setState = function(name, value) {
	this.states[name] = value;

	return this;
};

DragPosition.prototype.getState = function(name) {
	return this.states[name];
};


$(function() {
	var $dragTarget = $('#hoge');
	var dragAction = new DragAction();
	var dragPosition = new DragPosition();
	var messenger = new Messenger(dragPosition);

	var $minimap = $dragTarget.clone();
	var $minimapWrap = $('#minimap');
	var $highlight = window.$highlight = $('<div>a</div>');

	var scale = window.scale = $minimapWrap.height() / $dragTarget.height();
	var posX = $minimapWrap.width() / 2 - $minimapWrap.height() / $dragTarget.height() * $dragTarget.width() / 2;
	var transformStyle = 'scale(' + scale  + ')';
	var minimapleft = posX;

	var offsetStore = $dragTarget.offset();

	dragAction
		.on('start', function(result) {
			messenger.dispatch('change', result);
		})
		.on('stop', function(result) {
			messenger.dispatch('complete', result);
		})
		.on('move', function(result) {
			messenger.dispatch('move', result);
		});

	dragPosition
		.on('change', function(result) {
			this
				.setState('dragH', result.dragH)
				.setState('dragW', result.dragW)
				.setState('posY', result.posY)
				.setState('posX', result.posX);
		})
		.on('move', function(result) {
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
		.on('complete', function(result) {
			console.log('complete');
			result.callback();
		});

	$dragTarget
		.bind('mousedown.draggable touchstart.draggable', function(e) {
			e.preventDefault();

			setTimeout(function() {
				var dragH = $dragTarget.outerHeight();
				var dragW = $dragTarget.outerWidth();
				var posY = $dragTarget.offset().top + dragH - e.pageY;
				var posX = $dragTarget.offset().left + dragW - e.pageX;

				$dragTarget.addClass('draggable');

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
			}, 1000 / 60);
		});

	$('html')
		.bind('mousemove.draggable touchmove.draggable', function(e) {
			e.preventDefault();

			var eY, eX;

			if (e.originalEvent.changedTouches) {
				eY = e.originalEvent.changedTouches[0].pageY;
				eX = e.originalEvent.changedTouches[0].pageX;
			} else {
				eY = e.pageY;
				eX = e.pageX;
			}

			dragAction.move({
				eY: eY,
				eX: eX,
				callback: function(pos) {
					setTimeout(function() {
						if ($('.draggable').length > 0) {
							$highlight.css({
								'margin-top': $highlight.position().top - (pos.top - offsetStore.top) * scale,
								'margin-left': (pos.left - offsetStore.left) * scale
							});
							$('.draggable').offset(pos);
						}
					}, 4);
				}
			});
		})
		.bind('mouseup.draggable touchend', function() {
			dragAction.stop({
				callback: function() {
					$dragTarget.removeClass('draggable');
				}
			});
		});




	$minimapWrap
		.html($minimap)
		.append($highlight);

	$minimap
		.attr('id', '')
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

	$highlight.css({
		'width': 710,
		'height': 452,
		'position': 'absolute',
		'top': '0',
		'left': minimapleft,
		'background': 'rgba(0,0,0,.6)',
		'transform-origin': '0 0',
		'-webkit-transform': transformStyle,
		'-moz-transform': transformStyle,
		'-ms-transform': transformStyle,
		'-o-transform': transformStyle,
		'transform': transformStyle
	});
});


