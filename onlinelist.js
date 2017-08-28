'use strict';

(function( doc, ConfigurationSet, Universe ) {

var config;

function start() {
	var cs = new ConfigurationSet();
	var universe = Universe.getServer( doc );

	cs.addKey( universe + 'OnlineListEnabled', 'onlineListEnabled' );
	cs.addKey( universe + 'OnlineList', 'onlineList' );

	config = cs.makeTracker( applyColor );
}

function applyColor () {
	// Function applieds red bgcolor to cells that match the criteria.
	if (config.onlineListEnabled) {

		// Parse the options valule to an array.

		var onlinelist = config.onlineList.replace(/\n|\t/g,",").split(',');

		// Number of online players to check is on the webpage
		var onlineplayers = parseInt(document.getElementsByTagName('p')[0].innerHTML.split(' ')[3]);

		// Table 7 is the table with online pilots.
		var cells = document.getElementsByTagName('table')[6].getElementsByTagName('td');

		for (var i=0; i<onlineplayers; i++) {
			for (var j = 0; j < onlinelist.length; j++) {
				// Checking every name against the to-mark list.
				if (cells[i].firstChild.innerHTML == onlinelist[j]) {
					cells[i].setAttribute("bgcolor", "red");
				}
			}
		}
	}
}

start();

})( document, ConfigurationSet, Universe );
