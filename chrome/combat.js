// This content script drives the ship2ship, ship2opponent, and
// building pages, which are much alike.

'use strict';

(function( doc, ConfigurationSet, ShipLinks, Universe ){

var config, shipLinksAdded, botsAvailable, shipCondition, damageDisplayed;

//milliseconds
var oneHour = 3600000;
var halfHour = 1800000;

function start() {
	var match, pageShipLinks, autoRoundsKey, autoMissilesKey,
		cs, universeName, features;

	// Enable features depending on which page we're running on.
	var featureSets = {
		building: {
			shipLinks: true,
			autoRoundsKey: null,
			autoMissilesKey: 'pvbMissileAutoAll'
		},
		ship2opponent_combat: {
			shipLinks: false,
			autoRoundsKey: 'pvmHighestRounds',
			autoMissilesKey: 'pvmMissileAutoAll'
		},
		ship2ship_combat: {
			shipLinks: true,
			autoRoundsKey: 'pvpHighestRounds',
			autoMissilesKey: 'pvpMissileAutoAll'
		}
	};
	match = /^\/([^./]+)\.php/.exec( doc.location.pathname );
	features = featureSets[ match[1] ];

	if ( !features ) {
		throw new Error('running on unexpected pathname');
	}

	cs = new ConfigurationSet();
	universeName = Universe.getName( doc );
	cs.addKey( 'autobots' );
	cs.addKey( 'autobots' + universeName + 'Points', 'autobotsPoints' );
	cs.addKey( 'autobots' + universeName + 'Strength', 'autobotsStrength' );
	cs.addKey( features.autoMissilesKey, 'autoMissiles' );
	cs.addKey( 'displayDamage' );
	cs.addKey( 'clockD' );
	cs.addKey( 'clockStim' );

	if ( features.shiplinks ) {
		cs.addKey( 'navShipLinks' );

	}
	if ( features.autoRoundsKey ) {
		cs.addKey( features.autoRoundsKey, 'autoRounds' );
	}

	config = cs.makeTracker( applyConfiguration );
}

// Called by the configuration tracker when something changes.
function applyConfiguration() {
	var ships;

	// Ship links
	if ( shipLinksAdded ) {
		ShipLinks.removeElementsByClassName( doc, 'psw-slink' );
	}
	if ( config.navShipLinks ) {
		ships = ShipLinks.getShips( doc,
			"//table/tbody[tr/th = 'Other Ships']/tr/td/a", matchShipId );
		ShipLinks.addShipLinks( ships );
		shipLinksAdded = true;
	}

	// Autobots
	if ( config.autobots ) {
		if ( ! botsAvailable ) {
			botsAvailable = getBotsAvailable( doc );
		}
		if ( ! shipCondition ) {
			shipCondition = getShipCondition();
		}

		fillBots( botsAvailable, shipCondition.components,
				  config.autobotsPoints, config.autobotsStrength );
	}

	// Automissiles
	if ( config.autoMissiles ) {
		checkAllMissiles();
	}

	// Autorounds
	if ( config.autoRounds ) {
		selectHighestRounds();
	}

	// Drug timer
	if ( config.clockD ) {
		addDrugTimer();
	}


	if ( config.clockStim) {
		addStimTimer();
	}
	// Display damage
	if ( config.displayDamage && !damageDisplayed ) {
		if ( ! shipCondition ) {
			shipCondition = getShipCondition();
		}
		displayDamage( shipCondition );
		damageDisplayed = true;
	}
}

function matchShipId( url ) {
	var r, match;

	// This could be smarter, doing proper URL-decode of the
	// building.php query string, but it isn't likely that'll be
	// needed, and it would slow things down.
	match =
		/building\.php\?detail_type=([A-Za-z]+)&detail_id=(\d+)$/.exec( url );
	if ( match ) {
		r = { type: match[ 1 ], id: parseInt( match[ 2 ] ) };
	}

	return r;
}

// Looks for robots in the "use resources" form.  Returns an object
// with properties: count (an integer) and input (the text field where
// you type how many robots to use). If no bots are found, an object
// will still be returned, but these properties won't be defined.

function getBotsAvailable() {
	var tr, xpr, available, input, result = {};

	tr = doc.evaluate(
		"//tr[td/input[@name = 'resid' and @value = 8]]",
		doc, null, XPathResult.ANY_UNORDERED_NODE_TYPE,
		null ).singleNodeValue;
	if ( tr ) {
		xpr = doc.evaluate(
			"td[position() = 2]|td/input[@name = 'amount']",
			tr, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null );
		available = xpr.iterateNext();
		if ( available ) {
			result.count = parseInt( available.textContent );
			if ( result.count > 0 ) {
				input = xpr.iterateNext();
				if ( input ) {
					result.input = input;
				}
			}
		}
	}

	return result;
}

// Given bot availability and ship condition data, as collected by
// getBotsAvailable and getShipCondition, this computes the number of
// bots required to repair the ship's armour as close as possible to
// the desired points, without wasting bots.
//
// Returns the positive number of bots required, or zero if the
// armour requires no repairs, or -1 if the result can't be
// computed.

function requiredBots( available, componentsCondition,
					   configuredPoints, configuredStrength ) {
	var n, avbcount, points;

	avbcount = available.count;

	if ( avbcount == undefined || !(avbcount >= 0) ||
		 !componentsCondition.selfArmor ||
		 !( configuredPoints > 0 ) || !( configuredStrength > 0 ) ) {
		return -1;
	}

	points = componentsCondition.selfArmor.points;

	if ( points < configuredPoints ) {
		n = Math.floor( (configuredPoints - points) / configuredStrength );
		return ( n > avbcount ? avbcount : n );
	}

	return 0;
}

// Computes the required amount of bots and fills the amount field
// as appropriate.

function fillBots( available, componentsCondition,
				   configuredPoints, configuredStrength ) {
	var n;

	n = requiredBots( available, componentsCondition,
					  configuredPoints, configuredStrength);
	if ( n >= 0 && available.input ) {
		available.input.value = n > 0 ? n : '';
	}
}

// Looks for ship statuses in combat and building pages - those are
// the green, yellow or red thingies that say "Hull points: 225", etc.
//
// Sadly, even after the 2013-09-14 update, which touched this very
// bit, at least for the building page, Pardus still doesn't add a
// proper id to those fields, like it does in the nav page.
//
// So we have to identify these heuristically. These bits are in
// <font> tags (yeah, deprecated tags, too).  There aren't that many
// font tags in the document, so we just use getElementsByTagName and
// find them by matching the text in each one.
//
// If any ship statuses are found, this returns an object with two
// properties: shipComponents, and textElements. Each of those contain
// properties selfHull, selfArmor (thusly mispelled :P), selfShield,
// and, if the page shows an opponent, also otherHull, otherArmor,
// otherShield.  Don't rely on any of these to be present, except
// perhaps selfHull.

function getShipCondition() {
	var fonts, i, end, font, textElement, match, key, value, points,
		table, width, rx = /^(Hull|Armor|Shield) points(?:: (\d+))?$/,
		result, componentCount = 0;

	result = {
		components: {},
		textElements: {}
	};

	fonts = doc.getElementsByTagName( 'font' );
	for (i = 0, end = fonts.length; i < end; i++ ) {
		font = fonts[ i ];
		textElement = font.firstChild;

		if ( textElement && textElement.nodeType == 3 ) {
			match = rx.exec( textElement.nodeValue );
			if ( match ) {
				points = match[ 2 ];
				if ( points ) {
					key = 'self' + match[ 1 ];
					value = { points: parseInt( points ), accurate: true };
				}
				else {
					key = 'other' + match[ 1 ];
					value = { inferred: true };

					table = font.nextElementSibling;
					if ( table && table.tagName == 'TABLE' ) {
						width = table.attributes[ 'width' ];
						if ( width ) {
							points = parseInt( width.value );
							value.points = 2 * points;
							value.accurate = ( points < 300 );
						}
					}
				}

				result.components[ key ] = value;
				result.textElements[ key ] = textElement;
				componentCount++;
			}
		}
	}

	result.count = componentCount;
	return result;
}

function checkAllMissiles() {
	var allMissiles, inputs, input, i, end;

	allMissiles = doc.getElementById( 'allmissiles' );
	if ( allMissiles ) {
		allMissiles.checked = true;
	}

	// This is what the game's javascript does in this case, more or less:
	inputs = doc.getElementsByTagName( 'input' );
	for ( i = 0, end = inputs.length; i < end; i++ ) {
		input = inputs[ i ];
		if ( input.type == 'checkbox' &&
			 input.name.indexOf( '_missile' ) != -1 ) {
			input.checked = true;
		}
	}
}

function selectHighestRounds() {
	var select;

	select = doc.evaluate(
		'//select[@name = "rounds"]', doc, null,
		XPathResult.ANY_UNORDERED_NODE_TYPE, null ).singleNodeValue;
	if ( select ) {
		if ( select.style.display == 'none' &&
				select.nextElementSibling.tagName == 'SELECT' ) {
			// for some reason, Pardus now hides the rounds select,
			// and instead adds a second, visible select element, with
			// a gibberish name.
			select = select.nextElementSibling;
		}

		selectMaxValue( select );
	}
}

function selectMaxValue( select ) {
	var opts = select.options, i, end, n, max = -1, maxindex = -1;

	for ( i = 0, end = opts.length; i < end; i++) {
		n = parseInt( opts[ i ].value );
		if ( n > max )
			maxindex = i;
	}

	if ( maxindex >= 0 ) {
		select.selectedIndex = maxindex;
	}
}

function displayDamage( shipCondition ) {
	var pscc, psccTimestamp, now, key, component, previousComponent,
		textElement, text, textLength, diff;

	// See if there's a saved ship condition stored in the top window

	now = Math.floor( Date.now() / 1000 );
	pscc = top.psSCC,
	psccTimestamp = top.psSCCTimestamp || 0;
	if ( pscc ) {
		// Hardcoded 5. PSS is saved when the user clicks on combat.
		// so, if we get a new combat screen within 5 seconds of having
		// left another, we assume this is the same combat continuing and
		// show damage.  I don't think this is unreasonable...
		if ( Math.abs( now - psccTimestamp ) > 5 ) {
			pscc = undefined;
		}
	}

	// And save the ship condition
	top.psSCC = shipCondition.components;
	top.psSCCTimestamp = now;

	for ( key in shipCondition.components ) {
		component = shipCondition.components[ key ];
		textElement = shipCondition.textElements[ key ];
		text = textElement.data;
		textLength = text.length;

		if ( component.inferred) {
			if ( component.accurate ) {
				text += ': ' + component.points;
			}
			else {
				text += ': ' + component.points + '+';
			}
		}

		if ( pscc ) {
			previousComponent = pscc[ key ];
			if ( component.accurate && previousComponent &&
					previousComponent.accurate &&
					component.points != previousComponent.points ) {
				diff = component.points - previousComponent.points;
				if ( diff > 0 ) {
					diff = '+' + diff;
				}
				text += ' (' + diff + ')';
			}
		}

		if ( textLength != text.length ) {
			textElement.data = text;
		}
	}
}

function addDrugTimer() {
	var tr;
	var comms = ['51','29','30','31','32'];
	for ( var i = 0; i < comms.length ; i++ ) {
		tr = doc.evaluate(
			"//tr[td/input[@name = 'resid' and @value = " + comms[i] + "]]",
			doc, null, XPathResult.ANY_UNORDERED_NODE_TYPE,
			null ).singleNodeValue;
		if ( tr ) {
			tr.lastChild.lastChild.addEventListener( 'click', usedDrugs.bind( tr ) );
		}
	}
}


function addStimTimer() {
	for (var resid = 29;resid<=32;resid++){
		var tr;
		tr = doc.evaluate(
			"//tr[td/input[@name = 'resid' and @value = " + resid + "]]",
			doc, null, XPathResult.ANY_UNORDERED_NODE_TYPE,
			null ).singleNodeValue;
		if ( tr ) {
			tr.lastChild.lastChild.addEventListener( 'click', usedStims );
		}
	}
}

function usedDrugs( tr ) {
	var input = doc.evaluate(
		"//tr/td/input[@name = 'resid' and @value = 51]",
		doc, null, XPathResult.ANY_UNORDERED_NODE_TYPE,
		null ).singleNodeValue;

	var amount = parseInt(input.nextElementSibling.value);
	var ukey = Universe.getServer ( document ).substr( 0, 1 );

	chrome.storage.sync.get(
		[ ukey + 'drugTimerLast', ukey + 'drugTimerClear'],
		usedDrugs2.bind(null, amount, input.value, ukey) );
}

function usedDrugs2( amount, ukey, data ) {
	if (!data[ ukey + 'drugTimerClear'] ) {
		data = new Object();
		data[ ukey + 'drugTimerClear'] = 0;
	}
	var now = Date.now();

	if (data[ ukey + 'drugTimerClear'] > now ) {
		data[ ukey + 'drugTimerClear'] += amount * oneHour;
	}
	else {
		var lastTick = new Date().setUTCHours(0,59,0,0); 
		lastTick += oneHour * Math.floor((now - lastTick) / oneHour);
		data[ ukey + 'drugTimerClear' ] = amount * oneHour + lastTick;
	}
	data[ ukey + 'drugTimerLast' ] = now;
	chrome.storage.sync.set ( data );
}

function usedStims( tr ) {
	for (var resid = 29 ; resid <= 32; resid++) {
		var input = doc.evaluate(
			"//tr/td/input[@name = 'resid' and @value = " + resid + "]",
			doc, null, XPathResult.ANY_UNORDERED_NODE_TYPE,
			null ).singleNodeValue;
		if (input)  {
			var amount = parseInt(input.nextElementSibling.value);
			if (!(amount > 0))
				 return;
			var ukey = Universe.getServer ( document ).substr( 0, 1 );

			//29 is the resid of green stims.
			if (resid == 29)
				amount *= 2;

			chrome.storage.sync.get(
				[ ukey + 'stimTimerLast', ukey + 'stimTimerClear'],
				usedStims2.bind(null, amount, ukey) );
		}
	}
}


function usedStims2( amount,ukey, data ) {
	var now = Date.now();
	if (!data[ ukey + 'stimTimerClear'] ) {
		data = new Object();
		data[ ukey + 'stimTimerClear'] = 0;
	}

	if (data[ ukey + 'stimTimerClear'] > now) {
		data[ ukey + 'stimTimerClear'] += amount * halfHour;
	}
	else {
		var lastTick = new Date().setUTCHours(0,29,3,0); 
		lastTick += halfHour * Math.floor((now - lastTick) / halfHour);
		data[ ukey + 'stimTimerClear'] = amount * halfHour + lastTick;
	}
	data[ ukey + 'stimTimerLast' ] = now;
	chrome.storage.sync.set ( data );
}
start();

})( document, ConfigurationSet, ShipLinks, Universe );
