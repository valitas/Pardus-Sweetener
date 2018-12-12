
(function() {
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
		var mission = parseMission( this, premium );
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
		
	function parseMission( mission, premium ) {
        var output = new Object();
        if ( premium ) {
            var data = mission.getElementsByTagName( 'td' );
            output[ 'faction' ] = data[0].firstChild.src;
            output[ 'faction' ] === undefined ? output[ 'faction' ] = 'n' : output[ 'faction' ] = output[ 'faction' ].split( /\//g )[ 6 ][ 5 ];//check for neutral vs faction.
            output[ 'type' ] = data[1].firstChild.title[ 0 ];
            output[ 'timeLimit'] = parseInt( data[3].textContent );
            output[ 'sector'] = data[5].textContent;
			output[ 'image' ] = data[1].firstChild.src;
            if ( output.sector !== '-' ) {  
				output[ 'coords'] = data[6].textContent.split( /[\[,\]]/g );
				output[ 'coords'] = { 'x': parseInt( output[ 'coords'][1] ), 'y': parseInt( output[ 'coords'][2] ) }; //split coords in x and y.
				output[ 'locId' ] = Sector.getLocation( Sector.getId( output.sector ), output.coords.x, output.coords.y );
			} else {
				output[ 'locId' ] = missionCatalogue[ output.image.split(/\//g)[ 6 ] ];
				output[ 'amount' ] = parseInt( data[2].textContent );
			}
			output[ 'reward'] = parseInt( data[7].textContent.replace(/,/g,'') );
            output[ 'deposit'] = parseInt( data[8].textContent.replace(/,/g,'') );
            output[ 'id' ] = data[9].firstChild.id;
        } else {
			//Non-premmy not working fully yet.
			/*console.log(mission);
			var j, th = mission.getElementsByTagName( 'th' )[0];
			var td = mission.getElementsByTagName( 'td' );
			output[ 'faction' ] = th.firstChild.src;
			output[ 'faction' ] === undefined ? output[ 'faction' ] = 'n' : output[ 'faction' ] = output[ 'faction' ].split( /\//g )[ 6 ][ 5 ];//check for neutral vs faction.
			output[ 'type' ] = th.textContent[ 1 ];
			
			var bold0 = td[ 3 ].getElementsByTagName( 'b' );
			var bold2 = td[ 2 ].getElementsByTagName( 'b' );
			if( bold2.length === 7 ) {
				//transport or untargeted mission
				j = 2;
			} else {
				j = 1;
			}
				
			output[ 'sector' ] = bold2[ j ].textContent;
			output[ 'image' ] = td[ 0 ].firstChild.src;
			if ( isNaN( parseInt( bold0[ 0 ].textContent ) ) || output.type === 'T' ) {	
				output[ 'coords' ] = bold2[ j + 1 ].textContent.split( /,/g );
				output[ 'coords'] = { 'x': parseInt( output[ 'coords'][0] ), 'y': parseInt( output[ 'coords'][1] ) }; //split coords in x and y.
				output[ 'locId' ] = Sector.getLocation( Sector.getId( output.sector ), output.coords.x, output.coords.y );
				output[ 'reward' ] = bold2[ j + 3 ].textContent.replace( /,/g, '' );
				output[ 'timeLimit' ] = parseInt( bold2[ j + 2 ].textContent );
			} else {
				output[ 'amount' ] = parseInt( bold0[0].textContent );
				output[ 'locId' ] = missionCatalogue[ output.image.split(/\//g)[ 6 ] ];
				output[ 'reward' ] = bold2[ 1 ].textContent.replace( /,/g, '' );
				output[ 'timeLimit' ] = parseInt( bold2[ 2 ].textContent );
			}
			var f = document.evaluate( "//td//font[starts-with(.,'Deposit')]",
						   mission, null, XPathResult.ANY_UNORDERED_NODE_TYPE,
						   null ).singleNodeValue;
			console.log(f);
			output[ 'deposit' ] = f.textContent.split( / /g )[12].replace( /,/g, '' );
			output[ 'id' ] = mission.getElementsByTagName( 'a' )[0].parentNode.id;
        */}
		
		output[ 'acceptTime' ] = Math.floor( Date.now() / 1000 );
        return output
    }
	
	var missionCatalogue = { 'ancient_crystal.png': -1,
		'asp_hatchlings.png': -2,
		'asp_mother.png': -3,
		'bio_scavenger.png': -4,
		'blood_amoeba.png': -5,
		'blue_crystal.png': -6,
		'ceylacennia.png': -7,
		'cyborg_manta.png': -8,
		'dreadscorp.png': -9,
		'drosera.png': -10,
		'energybees.png': -11,
		'energy_locust.png': -12,
		'energy_minnow.png': -13,
		'energy_sparker.png': -14,
		'eulerian.png': -15,
		'euryale.png': -16,
		'euryale_swarmlings.png': -17,
		'exocrab.png': -18,
		'feral_serpent.png': -19,
		'feral_serpent_1.png': -20,
		'feral_serpent_2.png': -21,
		'feral_serpent_3.png': -22,
		'frost_crystal.png': -23,
		'fuel_tanker.png': -24,
		'glowprawn.png': -25,
		'gorefang.png': -26,
		'gorefangling.png': -27,
		'gorefanglings.png': -28,
		'hidden_drug_stash.png': -29,
		'ice_beast.png': -30,
		'infected_creature.png': -31,
		'locust_hive.png': -32,
		'lucidi_mothership.png': -33,
		'lucidi_squad.png': -34,
		'lucidi_warship.png': -35,
		'manifestation_developed.png': -36,
		'manifestation_ripe.png': -37,
		'manifestation_verdant.png': -38,
		'medusa.png': -39,
		'medusa_swarmlings.png': -40,
		'mutated_medusa.png': -41,
		'nebula_locust.png': -42,
		'nebula_mole.png': -43,
		'nebula_serpent.png': -44,
		'oblivion_vortex.png': -45,
		'pirate_captain.png': -46,
		'pirate_experienced.png': -47,
		'pirate_famous.png': -48,
		'pirate_inexperienced.png': -49,
		'preywinder.png': -50,
		'rive_crystal.png': -51,
		'roidworm_horde.png': -52,
		'sarracenia.png': -53,
		'shadow.png': -54,
		'slave_trader.png': -55,
		'smuggler_escorted.png': -56,
		'smuggler_lone.png': -57,
		'solar_banshee.png': -58,
		'space_clam.png': -59,
		'space_crystal.png': -60,
		'space_dragon_elder.png': -61,
		'space_dragon_queen.png': -62,
		'space_dragon_young.png': -63,
		'space_locust.png': -64,
		'space_maggot.png': -65,
		'space_maggot_mutated.png': -66,
		'space_snail.png': -67,
		'space_worm.png': -68,
		'space_worm_albino.png': -69,
		'space_worm_mutated.png': -70,
		'starclaw.png': -71,
		'stheno.png': -72,
		'stheno_swarmlings.png': -73,
		'vyrex_assassin.png': -74,
		'vyrex_hatcher.png': -75,
		'vyrex_larva.png': -76,
		'vyrex_mutant_mauler.png': -77,
		'vyrex_stinger.png': -78,
		'x993_battlecruiser.png': -79,
		'x993_mothership.png': -80,
		'x993_squad.png': -81,
		'xalgucennia.png': -82,
		'z15_fighter.png': -83,
		'z15_repair_drone.png': -84,
		'z15_scout.png': -85,
		'z15_spacepad.png': -86,
		'z16_fighter.png': -87,
		'z16_repair_drone.png': -88
		};
})();