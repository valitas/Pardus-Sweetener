
(function( Mission ) {
    'use strict';

	//var cs = new ConfigurationSet();
	
	var ukey = Universe.getServer ( document ).substr( 0, 1 );	
	var premium = true, missions;
    
	var missionDiv = document.getElementById( 'missions' );
    if ( !missionDiv ) {
        premium = false;
    }
    if ( premium ) {
        missions = missionDiv.getElementsByTagName( 'tbody' )[0].childNodes;
    } else {
        missions = document.getElementById( 'div_missions' ).getElementsByTagName( 'table' );
    }

    for( var i = 0; i < missions.length; i++) {
        if ( !premium && i % 2 === 1 ) { continue; }
		if ( premium && i === 0 ) { continue; }
			
		let a = missions[i].getElementsByTagName( 'a' );		
		a[ a.length - 1 ].addEventListener( 'click', clickedMission.bind( missions[i], premium ) );
    }

	function clickedMission( premium ) {
		var mission = Mission.parseMission( this, premium, true );
		let get = [ ukey + 'm' + mission.locId, ukey + 'mlist' ];
		chrome.storage.local.get( get, storeMission.bind( null, mission ) );
	}
	
    function storeMission( mission, data ) {
		// We get the mission data from the earlier derived variables.

		if ( !data[ ukey + 'mlist' ] ) {
			// first time, let's be gentle.
			data[ ukey + 'mlist' ] = [];
		}
		
		if (!data[ ukey + 'm' + mission.locId ]) {
			// New mission to this location!
			mission.total = 1;
			data[ ukey + 'm' + mission.locId ] = mission;
			data[ ukey + 'mlist' ].push( mission.locId );
		} else if ( mission.locId !== -1 ) {
			// yay stacking targetted missions!
			data[ ukey + 'm' + mission.locId ].reward += mission.reward;
			data[ ukey + 'm' + mission.locId ].deposit += mission.deposit;
			data[ ukey + 'm' + mission.locId ].total += 1;
		} else {
			if ( data[ ukey + 'm' + mission.locId ].amount < mission.amount ) {
				data[ ukey + 'm' + mission.locId ].amount = mission.amount;
			}
			data[ ukey + 'm' + mission.locId ].reward += mission.reward;
			data[ ukey + 'm' + mission.locId ].deposit += mission.deposit;
		}
		chrome.storage.local.set( data );
	}
		
	

})( Mission );