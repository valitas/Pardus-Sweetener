// Clock prototypes

'use strict';

var PSClock = (function() {

	// This is the prototype of the basic timer. The clock creates
	// timers by instantiating an object from this prototype, then
	// mixing in specific functionality.

	var timerBase = {
		createNode: function( doc ) {
			var element, inner, textNode;

			element = doc.createElement( 'span' );
			textNode = doc.createTextNode( ' ' + this.label + ' ' );
			element.appendChild( textNode );

			inner = doc.createElement( 'span' );
			textNode = doc.createTextNode( '-:--' );
			inner.appendChild( textNode );
			element.appendChild( inner );
			element.appendChild( doc.createTextNode( ' ' ) );
			element.style.margin = '0 0 0 7px';
			element.style.cursor = 'default';
			element.title = this.title;

			this.element = element;
			this.textNode = textNode;

			return element;
		},

		formatTime: function( seconds ) {
			var hours, minutes, s;

			hours = Math.floor( seconds / 3600 );
			seconds -= hours*3600;
			minutes = Math.floor( seconds / 60 );
			seconds -= minutes*60;

			if ( hours > 0 ) {
				s = hours + ':';
				if ( minutes < 10 ) {
					s += '0';
				}
			}
			else {
				s = '';
			}
			s += minutes;
			s += ':';

			if ( seconds < 10 ) {
				s += '0';
			}
			s += seconds;

			return s;
		},

		computeColour: function( now,
								 red_threshold,
								 yellow_threshold,
								 green_threshold ) {
			if ( now <= red_threshold ) {
				return 'red';
			}

			if ( now <= yellow_threshold ) {
				return 'yellow';
			}

			if ( now <= green_threshold ) {
				return 'lime';
			}

			return null;
		},

		// This is used by most timers. It returns the number of
		// seconds remaining until the next tick, where ticks occur at
		// regular intervals.
		//
		// "now" is the Unix time.
		//
		// "offset" is the time at which the first tick of the day
		// occurs, expressed in seconds after midnight.
		//
		// (Strictly, it is the time at which the first interval
		// occurred in the epoch.  But, since all these Pardus
		// intervals are defined such that the length of the day is an
		// exact multiple of the length of the interval, it doesn't
		// matter if you think of it as the first tick on the 1st of
		// January 1970, or today, or any other day.)
		//
		// "period" is the time between ticks, in seconds.
		secondsToTick: function( now, offset, period ) {
			// It actually breaks if "now" is before the first tick of
			// the epoch.  Big deal huh.
			return period - 1 - ( now - offset ) % period;
		},

		// This is used by NPC and Z timers.  It returns the number of
		// seconds remaining until the next tick, where ticks occur at
		// a fixed number of arbitrary times distributed within a
		// regular interval.
		//
		// The regular interval is defined by offset and period, as
		// above.  Crontab is an array of integers in ascending order,
		// which define the times, in seconds after the start of the
		// interval, at which ticks occur.
		secondsToCrontabTick: function( now, offset, period, crontab ) {
			var n, i, end;

			// This is the number of seconds elapsed since the last
			// tick.
			n = ( now - offset ) % period;

			// Find the first entry that is larger than n. If n is
			// larger than all of them, then this will be the length
			// of the interval.
			for ( i = 0, end = crontab.length; i < end; i++ ) {
				var t = crontab[i];
				if ( t > n ) {
					return t - 1 - n;
				}
			}

			return period - 1 - n;
		}
	};

	// This object contains mixins that extend the basic timer to suit
	// the specific Pardus clocks.
	var timerMixins = {
		AP: {
			label: 'AP',
			title: 'Time to next 24 AP and next shield recharge',

			// AP ticks happen every 6 minutes, starting at minute 0.
			update: function( now ) {
				var rem = this.secondsToTick( now, 0, 360 );
				this.element.style.color =
					this.computeColour( rem, 10, 30, 60 );
				this.textNode.data = this.formatTime( rem );
			}
		},

		B: {
			label: 'B',
			title: 'Time to next building tick',

			// Building ticks happen every 6 hours, 25 minutes past
			// the hour, starting at 01:00 UTC.
			// Period is 6h (21600 s). Offset is 1h 25m (5100 s)
			update: function( now ) {
				var rem = this.secondsToTick( now, 5100, 21600 );
				this.element.style.color =
					this.computeColour( rem, 30, 180, 600 );
				this.textNode.data = this.formatTime( rem );
			}
		},

		P: {
			label: 'P',
			title: 'Time to next planet tick',

			// Planet ticks happen every 3 hours, 25 minutes past the
			// hour, starting at 02:00 UTC.
			// Period is 3h (10800 s). Offset is 2h 25m (8700 s)
			update: function( now ) {
				var rem = this.secondsToTick( now, 8700, 10800 );
				this.element.style.color =
					this.computeColour( rem, 30, 180, 600 );
				this.textNode.data = this.formatTime( rem );
			}
		},

		S: {
			label: 'S',
			title: 'Time to next starbase tick',

			// Starbase ticks happen every 3 hours, 25 minutes past
			// the hour, starting at 0:00 UTC.
			// Period is 3h (10800 s). Offset is 25m (1500 s)
			update: function( now ) {
				var rem = this.secondsToTick( now, 1500, 10800 );
				this.element.style.color =
					this.computeColour( rem, 30, 180, 600 );
				this.textNode.data = this.formatTime( rem );
			}
		},

		L: {
			label: 'L',
			title: 'Time to next leech armour repair',

			// Leech ticks happen every 20 minutes, starting at 00:00
			// UTC.
			// Period is 20m (1200 s), offset is zero.
			update: function( now ) {
				var rem = this.secondsToTick( now, 0, 1200 );
				this.element.style.color =
					this.computeColour( rem, 10, 60, 180 );
				this.textNode.data = this.formatTime( rem );
			}
		},

		E: {
			label: 'E',
			title: 'Time to next e-matter regeneration',

			// E-matter ticks happen every hour, starting at 05:31 UTC
			// Period is 60m (3600 s), offset is 5h 31m (19860 s).
			update: function( now ) {
				var rem = this.secondsToTick( now, 19860, 3600 );
				this.element.style.color =
					this.computeColour( rem, 10, 60, 180 );
				this.textNode.data = this.formatTime( rem );
			}
		},

		N: {
			label: 'N',
			title: 'Time to next roaming NPC move (not Z series, Lucidi)',

			// NPCs roam 7 times an hour, at minutes 08, 17, 26, 35,
			// 44, 53, 59.  So the encompassing period is 1h (3600 s),
			// offset is 8m (480 s), and ticks occur at the start of
			// the period, and 6 more times within the interval.
			update: function( now ) {
				// Times in the crontab are (17-8)*60, (26-8)*60, etc.
				var crontab = [540, 1080, 1620, 2160, 2700, 3060],
					rem = this.secondsToCrontabTick( now, 480, 3600, crontab );
				this.element.style.color =
					this.computeColour( rem, 10, 30, 60 );
				this.textNode.data = this.formatTime( rem );
			}
		},

		Z: {
			label: 'Z',
			title: 'Time to next Z series and Lucidi NPC move',

			// Zs and Lucies roam in like fashion as other NPCs, but
			// their timing is a bit different, at minutes 08, 17, 26,
			// 33, 41, 51, 59.
			update: function( now ) {
				var crontab = [540, 1080, 1500, 1980, 2580, 3060],
					rem = this.secondsToCrontabTick( now, 480, 3600, crontab);
				this.element.style.color =
					this.computeColour( rem, 10, 30, 60 );
				this.textNode.data = this.formatTime( rem );
			}
		},

		R: {
			label: 'R',
			title: 'Time to next server reset',

			// Server reset occurs at 05:30 UTC every day.
			// Period is 1d (86400 s). Offset is 5h 30m (19800 s)
			update: function( now ) {
				var rem = this.secondsToTick( now, 19800, 86400 );
				this.element.style.color =
					this.computeColour( rem, 30, 180, 600 );
				this.textNode.data = this.formatTime( rem );
			}
		},

		D: {
			label: 'Drug',
			title: 'Time to being undrugged',

			// We have to get these values from storage
			update: function( now ) {
				var ukey = Universe.getServer( document )
				    .substr( 0, 1 );
				chrome.storage.sync.get(
					[ ukey + 'drugTimerClear' ],
					getDrugClearTime.bind( this, now, ukey )
				);

				function getDrugClearTime( now, ukey, data ) {
					var t = Math.floor(
						data[ ukey + 'drugTimerClear' ]
							/ 1000 );
					if ( t > now ) {
						this.textNode.data =
							this.formatTime(
								t - now );
					} else {
						this.textNode.data =
							this.formatTime( 0 );
					}
				}
			}
		},

		// This is not a timer per se, it just displays current UTC
		UTC: {
			// ... and we call it "GMT" because people get confused otherwise
			label: 'UTC',
			title: 'Coordinated Universal Time (Succesor of Greenwich Mean Time)',

			update: function( now ) {
				var t = now % 86400;
				this.textNode.data = this.formatTime( t );
			},

			// Override formatTime, as this is not a countdown and we
			// don't want to lose the leading zeros.
			formatTime: function( seconds ) {
				var hours, minutes, s;

				hours = Math.floor( seconds / 3600 );
				seconds -= hours*3600;
				minutes = Math.floor( seconds / 60 );
				seconds -= minutes*60;

				s = '';
				if ( hours < 10 ) {
					s += '0';
				}
				s += hours;
				s += ':';
				if ( minutes < 10 ) {
					s += '0';
				}
				s += minutes;
				s += ':';
				if ( seconds < 10 ) {
					s += '0';
				}
				s += seconds;

				return s;
			}
		},
		Stim: {
			label: 'Stim',
			title: 'Time to being unstimmed',

			// We have to get these values from storage
			update: function( now ) {
				var ukey = Universe.getServer( document )
				    .substr( 0, 1 );
				chrome.storage.sync.get(
					[ ukey + 'stimTimerClear' ],
					getStimClearTime.bind( this, now, ukey )
				);

				function getStimClearTime( now, ukey, data ) {
					var t = Math.floor(
						data[ ukey + 'stimTimerClear' ]
							/ 1000 );
					if ( t > now ) {
						this.textNode.data =
							this.formatTime(
								t - now );
					} else {
						this.textNode.data =
							this.formatTime( 0 );
					}
				}
			}
		},
	};

	// Names of all available timers. Bit redundant, as we already
	// have these names, as keys in timerMixins. But this defines the
	// order in which we render them.
	var TIMERS =
	    [ 'AP', 'P', 'S', 'B', 'L', 'E', 'N', 'Z', 'D','Stim', 'UTC', 'R'];

	// Creates an instance of the clock object.
	function PSClock( doc ) {
      if ( !doc )
        throw new Error( 'PSClock constructor called with null doc' );
	  this.doc = doc;
	  this.enabledTimers = {};
	  this.needRebuild = false;
	}

	PSClock.prototype = {
		setEnabled: function( which, enabled ) {
			var timer = this.enabledTimers[ which ];

			if ( enabled ) {
				if ( !timer ) {
					var mixin = timerMixins[ which ];
					if ( !mixin ) {
						throw new Error( 'Unknown timer ' + which );
					}

					timer = Object.create( timerBase );

					for ( var key in mixin ) {
						timer[ key ] = mixin[ key ];
					}

					this.enabledTimers[ which ] = timer;
					this.needRebuild = true;
				}
				// else it's fine, we already had it enabled
			}
			else {
				if ( timer ) {
					delete this.enabledTimers[ which ];
					// We could actually optimise removing of a timer
					// without requiring a rebuild.  Not very useful
					// tho, just a tiny performance gain while you're
					// mucking about with settings, probably not even
					// watching the pardus tab...
					this.needRebuild = true;
				}
				// else nop, wasn't enabled anyway
			}
		},

		createContainer: function() {
			var doc = this.doc, body = doc.body,
				div = doc.createElement( 'div' );

			//div.style.fontSize = '10px';
			div.style.position = 'fixed';
			div.style.top = 0;
			div.style.right = '10px';
			div.style.width = 'auto';
			body.insertBefore( div, body.firstChild );
			this.container = div;
		},

		resetContainer: function() {
          var div = this.container;
          if ( div ) {
            while( div.hasChildNodes() )
              div.removeChild( div.firstChild );
          }
		},

		removeContainer: function() {
			var div = this.container;

			if ( div ) {
				div.parentNode.removeChild( div );
				delete this.container;
			}
		},

		rebuild: function() {
			if ( Object.keys( this.enabledTimers ).length > 0 ) {
				var doc, container;

				// We're going to add at least one. We need a div.
				if ( this.container ) {
					this.resetContainer();
				}
				else {
					this.createContainer();
				}

				doc = this.doc;
				container = this.container;

				// Add the enabled timers in the proper order
				for ( var i = 0, end = TIMERS.length; i < end; i++ ) {
					var timer = this.enabledTimers[ TIMERS[i] ];
					if ( timer ) {
						var element = timer.createNode( doc );
						container.appendChild( element );
					}
				}
			}
			else {
				// No timers enabled. Remove the div if we inserted one
				if ( this.container ) {
					this.removeContainer();
				}
			}

			this.needRebuild = false;
		},

		update: function() {
			if ( this.needRebuild ) {
				this.rebuild();
			}

			// Date.now() is non-standard, but Chrome supports it
			// (and Firefox, too).
			//
			// (should be (new Date()).milliseconds() or some such).
			var now = Math.floor( Date.now() / 1000 );
			for ( var k in this.enabledTimers ) {
				this.enabledTimers[k].update( now );
			}
		},

		start: function() {
			this.update();
			var self = this, callback = function() { self.update(); };
			this.doc.defaultView.setInterval( callback, 1000 );
		},

		sink: function( sunk ) {
			if ( this.container) {
				this.container.style.zIndex = sunk ? '-1' : 'inherit';
			}
		}
	};

	return PSClock;

})();
