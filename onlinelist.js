(function() {
    'use strict';
	function applycolor (onlinelist) {
		// Function applieds red bgcolor to cells that match the criteria.
		
		// Parse the options valule to an array.
		onlinelist = onlinelist["onlinelist"].replace(/\n|\t/g,",").split(',');
	
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
	
	
	function enableapplycolor (check) {
		// Function determines if we want to highlight online pilots.
		if (check['onlinelistEnabled']) { 
			chrome.storage.local.get('onlinelist',applycolor);
		}
	}
	chrome.storage.local.get('onlinelistEnabled',enableapplycolor);
})();