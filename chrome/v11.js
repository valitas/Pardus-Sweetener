// New nav script

class MiniMap {
    static #INSIDE_STATUS = Symbol('inside-status')
    static #ABOVE_CARGO = Symbol('above-cargo')
    static #UNDER_NAV = Symbol('under-nav')
    static #UNDER_NAV_XL = Symbol('under-nav-xl')
    // Map from option values in options.html
    static PLACEMENT_KEY_MAP = {
        'statusbox': this.#INSIDE_STATUS,
        'topright': this.#ABOVE_CARGO,
        'navbox': this.#UNDER_NAV,
        'navboxXL': this.#UNDER_NAV_XL
    }

    #doc
    #enabled = false
    #placement = this.STATUS_BOX
    #sector
    #containerElement
    #canvas
    #size

    constructor(document) {
        console.debug('new MiniMap', document)

        this.#doc = document
        this.#asyncInit().then(() => console.log('v11 minimap configured'))
    }

    async #asyncInit() {
        const [config, sector] = await Promise.all([
            chrome.storage.local.get(['miniMap', 'miniMapPlacement']),
            this.#getSector()
        ])

        this.#enabled = Boolean(config.miniMap)
        this.#placement = MiniMap.#placementID(config.miniMapPlacement)
        this.#sector = sector
    }

    async #getSector() {
        const e = this.#doc.getElementById('sector');
        if (e === null) {
            throw new Error("MiniMap can't retrieve sector name from document")
        }
        const name = e.textContent
        const sector = await chrome.runtime.sendMessage({ requestMap: name })
        return sector
    }

    // Needs #placement and #sector set before calling. Sets #containerElement
    #injectElement() {
        let container, canvas, size

        // If we were showing a map, get shot of it, we're rebuilding it anyway.
        this.#removeElement()

        // Create the map canvas
        this.#canvas = this.#doc.createElement('canvas')

        /* XXX - map route?
        // Create the div that will hold distance calculations
        div = doc.createElement( 'div' );
        div.style.paddingTop = '4px';
        div.style.height = '48px';
        div.style.display = 'none';
        */

        // Figure out where to place the map and what size it should be.
        switch (this.#placement) {
            case MiniMap.#UNDER_NAV:
                this.#injectElementInNav(false)
                break
            case MiniMap.#UNDER_NAV_XL:
                this.#injectElementInNav(true)
                break
            case MiniMap.#ABOVE_CARGO:
                break
            default:
                this.#injectElementInStatusBox()
        }

        if (this.#containerElement === undefined) {
            // something went wrong, abort
            console.debug('unable to insert minimap')
            return
        }


        // if (config.miniMapNavigation) {
        //    minimap.enablePathfinding();
        // }

        // And draw the map.
        //refreshMinimap();
    }

    // Sets #containerElement, #size
    #injectElementInStatusBox() {
        // The status box is a table with id "status", which contains three
        // rows. The first and last are graphic stuff, contain pics showing the
        // top and bottom of a box--all very early 2000's, this. The middle row
        // contains a td which in turn contains a div with id "status_content",
        // where all the status stuff is shown.
        //
        // Now the "status_content" div gets clobbered by partial refresh, so we
        // don't add our canvas to it, we want it to outlive partial refresh.
        // Also, partial refresh *appends* a new "status_content" div to the td
        // that contained the old one, so we can't add our map in that same td
        // either, or else the new status_content would end up below the old map
        // after the first partial refresh.
        //
        // So what we do instead is: we add a new tr to the status table, right
        // after the tr that contains status_content, and before the tr with the
        // bottom picture. And our map lives in that new tr.
        //
        // So. First find the td that contains "status_content"...
        const td = doc.evaluate(
            "//tr/td[div[@id = 'status_content']]",
            doc,
            null,
            XPathResult.ANY_UNORDERED_NODE_TYPE,
            null
        ).singleNodeValue
        if (!td) {
            return
        }

        // ... and then its parent tr, and whatever contains that (tbody of
        // course, but we don't care what exactly it is).
        const tr = td.parentNode;
        const tbody = tr.parentNode;

        // Then we shallow-clone both, so we get their attributes,
        // which include their styling. The new td will contain the
        // map canvas and the new tr will be the single element that
        // we'll insert in the document (read: the one that would have
        // to be removed to restore the document to its pristine
        // state).
        this.#containerElement = tr.cloneNode(false)
        const newtd = td.cloneNode(false);

        // Tweak a bit for looks. This is needed because Pardus' tables are
        // off centre with respect to the borders drawn as background
        // images. Crusty HTML there, I tell you.
        //
        // XXX - should we do this with an inserted stylesheet instead?
        // Arguably it would be the correct thing, but Pardus is already
        // full of these obsolete stylings.
        newtd.style.textAlign = 'center'
        newtd.style.paddingRight = '3px'

        // Finally, add the canvas and assemble the table row.
        newtd.appendChild(this.#canvas);
        // newtd.appendChild(div); XXX pathfinding stuff
        this.#containerElement.appendChild(newtd);
        tbody.insertBefore(this.#containerElement, tr.nextSibling);
        this.#size = 180;
    }

    // Sets #containerElement, #size
    #injectElementInNav(large) {
        // Add a big map under the navigation box.
        const td = doc.getElementById('tdSpaceChart')
        if (!td) {
            return
        }

        this.#containerElement = doc.createElement('div')
        this.#containerElement.style.textAlign = 'center'

        if (large) {
            this.#size = td.offsetWidth;
        } else {
            const nva = doc.getElementById("navarea")
            if (nva) {
                this.#size = nva.offsetWidth
            } else {
                this.#size = td.offsetWidth
            }
        }

        //put the distance text on top
        this.#containerElement.style.margin = '0 2px 24px auto';
        canvas.style.border = '1px outset #a0b1c9';
        // this.#containerElement.appendChild(div); XXX pathfinding stuff
        this.#containerElement.appendChild(this.#canvas);
        td.appendChild(this.#containerElement);
    }

    #injectElementAboveCargo() {
        // Add the map at the top of the right-side bar. This is easier: there's
        // a td that contains the whole sidebar, so we just insert a div as
        // first element.
        const td = doc.getElementById('tdTabsRight');
        if (!td) {
            return;
        }

        this.#containerElement = doc.createElement('div');
        this.#containerElement.style.textAlign = 'center';
        this.#containerElement.style.width = '208px';
        this.#containerElement.margin = '0 2px 0px auto';
        this.#canvas.style.border = '1px outset #a0b1c9';
        this.#containerElement.appendChild(this.#canvas);
        //this.#containerElement.appendChild(div); // XXX pathfinding stuff
        td.insertBefore(this.#containerElement, td.firstChild);
        this.#size = 200;
    }

    #removeElement() {
        if (this.#containerElement) {
            this.#containerElement.parentNode.removeChild(this.#containerElement)
            this.#containerElement = undefined
        }
    }

    static #placementID(key) {
        return this.PLACEMENT_KEY_MAP[key] || this.#INSIDE_STATUS
    }
}

const m = new MiniMap(document)
