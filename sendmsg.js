// Display the recipient's alliance on the sendmsg form.
// This is RIDICULOUSLY overengineered, don't laugh.

(function( doc ) {

var enabled, sweetened, allianceTR, mugshotTD;

function start( doc ) {
	chrome.storage.local.get( ['sendmsgShowAlliance'], onConfigurationReady );
}

function onConfigurationReady( items ) {
	enabled = items.sendmsgShowAlliance;

	if ( enabled ) {
		sweeten();
	}

	// Listen for changes in configuration.
	chrome.storage.onChanged.addListener( onConfigurationChange );
}

function onConfigurationChange( changes, area ) {
	if ( area != 'local' ) {
		return;
	}

	if ( changes.sendmsgShowAlliance ) {
		enabled = changes.sendmsgShowAlliance.newValue;
		if ( enabled ) {
			sweeten();
		}
		else {
			unsweeten();
		}
	}
}

function sweeten() {
	var recipient, recipientTD, recipientTR, mugshot,
		allianceName, match, td, i;

	if ( sweetened ) {
		return;
	}

	// The recipient field is contained in a TD. The next TD should
	// contain the mugshot, and the mugshot's alt (or title) should
	// contain the alliance name, which will be the text after the
	// dash. Bail out if any of these assumptions doesn't hold.

	recipient = doc.getElementById( 'recipient2' );
	if ( !recipient ) {
		return;
	}

	recipientTD = recipient.parentNode;
	if ( recipientTD.tagName != 'TD' ) {
		return;
	}

	recipientTR = recipientTD.parentNode;
	if ( recipientTR.tagName != 'TR' ) {
		return;
	}

	mugshotTD = recipientTD.nextElementSibling;
	if ( !mugshotTD || mugshotTD.tagName != 'TD' || mugshotTD.rowSpan != 2 ) {
		return;
	}

	mugshot = mugshotTD.firstElementChild;
	if ( !mugshot || mugshot.tagName != 'IMG' || !mugshot.alt ) {
		return;
	}

	match = /^[^-]+-\s*(.+?)\s*$/.exec( mugshot.alt );
	if ( !match ) {
		return;
	}

	allianceName = match[ 1 ];

	// Ok all seems good, make the changes
	allianceTR = doc.createElement( 'tr' );
	td = doc.createElement( 'td' );
	allianceTR.appendChild( td );

	td = doc.createElement( 'td' );
	if ( allianceName == 'No alliance participation' ) {
		i = doc.createElement( 'i' );
		i.textContent = 'No alliance participation';
		td.appendChild( i );
	}
	else {
		td.textContent = allianceName;
	}
	allianceTR.appendChild( td );

	mugshotTD.rowSpan = 3;
	recipientTR.parentNode.insertBefore( allianceTR, recipientTR.nextSibling );

	// We're done. Remember this.
	sweetened = true;
}

function unsweeten() {
	if ( !sweetened ) {
		return;
	}

	allianceTR.parentNode.removeChild( allianceTR );
	allianceTR = undefined;
	mugshotTD.rowSpan = 2;
	mugshotTD = undefined;
	sweetened = false;
}

start();

})( document );
