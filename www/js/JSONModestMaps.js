// namespacing!
if (!com) {
    var com = {};
}
if (!com.modestmaps) {
    com.modestmaps = {};
}

(function(MM) {
    //.JSONRequestManager
    // --------------
    // an image loading queue
    MM.JSONRequestManager = function() {

        // The loading bay is a document fragment to optimize appending, since
        // the elements within are invisible. See
        //  [this blog post](http://ejohn.org/blog/dom-documentfragments/).
        this.loadingBay = document.createDocumentFragment();

        this.requestsById = {};
        this.openRequestCount = 0;

        this.maxOpenRequests = 4;
        this.requestQueue = [];

        this.callbackManager = new MM.CallbackManager(this, [
            'requestcomplete', 'requesterror']);
    };

    MM.JSONRequestManager.prototype = {

        // DOM element, hidden, for making sure images dispatch complete events
        loadingBay: null,

        // all known requests, by ID
        requestsById: null,

        // current pending requests
        requestQueue: null,

        // current open requests (children of loadingBay)
        openRequestCount: null,

        // the number of open requests permitted at one time, clamped down
        // because of domain-connection limits.
        maxOpenRequests: null,

        // for dispatching 'requestcomplete'
        callbackManager: null,

        addCallback: function(event, callback) {
            this.callbackManager.addCallback(event,callback);
        },

        removeCallback: function(event, callback) {
            this.callbackManager.removeCallback(event,callback);
        },

        dispatchCallback: function(event, message) {
            this.callbackManager.dispatchCallback(event,message);
        },

        // Clear everything in the queue by excluding nothing
        clear: function() {
            this.clearExcept({});
        },

        clearRequest: function(id) {
            if(id in this.requestsById) {
                delete this.requestsById[id];
            }

            for(var i = 0; i < this.requestQueue.length; i++) {
                var request = this.requestQueue[i];
                if(request && request.id == id) {
                    this.requestQueue[i] = null;
                }
            }
        },

        // Clear everything in the queue except for certain keys, specified
        // by an object of the form
        //
        //     { key: throwawayvalue }
        clearExcept: function(validIds) {

            // clear things from the queue first...
            for (var i = 0; i < this.requestQueue.length; i++) {
                var request = this.requestQueue[i];
                if (request && !(request.id in validIds)) {
                    this.requestQueue[i] = null;
                }
            }

            // then check the loadingBay...
            var openRequests = this.loadingBay.childNodes;
            for (var j = openRequests.length-1; j >= 0; j--) {
                var img = openRequests[j];
                if (!(img.id in validIds)) {
                    this.loadingBay.removeChild(img);
                    this.openRequestCount--;
                    /* console.log(this.openRequestCount + " open requests"); */
                    img.src = img.coord = img.onload = img.onerror = null;
                }
            }

            // hasOwnProperty protects against prototype additions
            // > "The standard describes an augmentable Object.prototype.
            //  Ignore standards at your own peril."
            // -- http://www.yuiblog.com/blog/2006/09/26/for-in-intrigue/
            for (var id in this.requestsById) {
                if (!(id in validIds)) {
                    if (this.requestsById.hasOwnProperty(id)) {
                        var requestToRemove = this.requestsById[id];
                        // whether we've done the request or not...
                        delete this.requestsById[id];
                        if (requestToRemove !== null) {
                            requestToRemove =
                                requestToRemove.id =
                                requestToRemove.coord =
                                requestToRemove.url = null;
                        }
                    }
                }
            }
        },

        // Given a tile id, check whether the.JSONRequestManager is currently
        // requesting it and waiting for the result.
        hasRequest: function(id) {
            return (id in this.requestsById);
        },

        // * TODO: remove dependency on coord (it's for sorting, maybe call it data?)
        // * TODO: rename to requestImage once it's not tile specific
        requestTile: function(id, coord, url) {
            if (!(id in this.requestsById)) {
                var request = { id: id, coord: coord.copy(), url: url };
                // if there's no url just make sure we don't request this image again
                this.requestsById[id] = request;
                if (url) {
                    this.requestQueue.push(request);
                    /* console.log(this.requestQueue.length + ' pending requests'); */
                }
            }
        },

        getProcessQueue: function() {
            // let's only create this closure once...
            if (!this._processQueue) {
                var theManager = this;
                this._processQueue = function() {
                    theManager.processQueue();
                };
            }
            return this._processQueue;
        },

        // Select images from the `requestQueue` and create image elements for
        // them, attaching their load events to the function returned by
        // `this.getLoadComplete()` so that they can be added to the map.
        processQueue: function(sortFunc) {
            // When the request queue fills up beyond 8, start sorting the
            // requests so that spiral-loading or another pattern can be used.
            if (sortFunc && this.requestQueue.length > 8) {
                this.requestQueue.sort(sortFunc);
            }
            while (this.openRequestCount < this.maxOpenRequests && this.requestQueue.length > 0) {
                var request = this.requestQueue.pop();
                if (request) {
                    this.openRequestCount++;
                    //img.onload = img.onerror = this.getLoadComplete();
                    $.ajax({
                        url:request.url + "&id=" + request.id,
                        dataType:'json',
                        success:this.getLoadComplete()
                    });
                    /* console.log(this.openRequestCount + ' open requests'); */

                    
                    request = request.id = request.coord = request.url = null;
                }
            }
        },

        _loadComplete: null,

        // Get the singleton `_loadComplete` function that is called on image
        // load events, either removing them from the queue and dispatching an
        // event to add them to the map, or deleting them if the image failed
        // to load.
        getLoadComplete: function() {
            // let's only create this closure once...
            if (!this._loadComplete) {
                var theManager = this;
                this._loadComplete = function(data) {
                    //console.info(data);
                    var tile_id = data['tile_id'];
                    
                    var elem = document.createElement('canvas');
                    //console.info(elem);
                    elem.id = tile_id;
                    elem.className = "jsonlayer";
                    elem.height = 256;
                    elem.width = 256;
                    var zrc = tile_id.split(',');
                    var x = parseInt(zrc[2]),
                        y = parseInt(zrc[1]),
                        z = parseInt(zrc[0]);
                    elem.coord = new MM.Coordinate(y, x, z);
                    
                     
                    // z+1: x,x+1,y,y+1
                    var ctx = elem.getContext("2d");
                    //console.info((z+1)+'');
                    ctx.lineWidth = .2;
                    for (var zoom in data['zooms']) {
                        //var color = "rgba(0,0,0," + parseInt(zoom) *.01 + ")";
                        //var fillcolor = "rgba(0,0,0,.01)";
                        var fillcolor = zoomColors[zoom];
                        //var strokecolor = "rgba(0,0,0," + parseInt(zoom) *.03 + ")";
                        //var color = "rgb(0,0,0)";
                        console.info(zoom, fillcolor);
                        ctx.fillStyle = fillcolor;
                        //ctx.strokeStyle = strokecolor;
                        var dz = parseInt(zoom) - z;
                        var scale = Math.pow(2,dz);
                        var sq = 256 / scale;
                        for (var i in data['zooms'][zoom]) {
                            var coord = data['zooms'][zoom][i];
                            var dx = coord['x'] - x * scale;
                            var dy = coord['y'] - y * scale;
                            //console.info(dx,dy,dz, z, dx*sq,dy*sq,sq,sq);
                            ctx.beginPath();
                            ctx.rect(dx*sq+0.5, dy*sq+0.5, sq, sq);
                            //ctx.arc(dx*sq,dy*sq,sq/2,0,Math.Pi*2,true);
                            ctx.closePath();
                    
                       //     ctx.stroke();
                            ctx.fill();
                        }
                    }
                   
                    
                    
                    
                    theManager.openRequestCount--;

                    delete theManager.requestsById[elem.id];

                    theManager.dispatchCallback('requestcomplete', elem);
                    setTimeout(theManager.getProcessQueue(), 0);
                };
            }
            return this._loadComplete;
        }

    };







 
    // JSONLayer

    MM.JSONLayer = function(provider, parent) {
        this.parent = parent || document.createElement('div');
        this.parent.style.cssText = 'position: absolute; top: 0px; left: 0px; width: 100%; height: 100%; margin: 0; padding: 0; z-index: 0';

        this.levels = {};

        this.requestManager = new MM.JSONRequestManager();
        this.requestManager.addCallback('requestcomplete', this.getTileComplete());

        if (provider) {
            this.setProvider(provider);
        }
    };

    MM.JSONLayer.prototype = {

        map: null, // TODO: remove
        parent: null,
        tiles: null,
        levels: null,

        requestManager: null,
        tileCacheSize: null,
        maxTileCacheSize: null,

        provider: null,
        recentTiles: null,
        recentTilesById: null,

        enablePyramidLoading: false,

        _tileComplete: null,

        getTileComplete: function() {
            if(!this._tileComplete) {
                var theLayer = this;
                this._tileComplete = function(manager, tile) {

                    // cache the tile itself:
                    theLayer.tiles[tile.id] = tile;
                    theLayer.tileCacheSize++;

                    // also keep a record of when we last touched this tile:
                    var record = {
                        id: tile.id,
                        lastTouchedTime: new Date().getTime()
                    };
                    theLayer.recentTilesById[tile.id] = record;
                    theLayer.recentTiles.push(record);

                    // position this tile (avoids a full draw() call):
                    theLayer.positionTile(tile);
                };
            }

            return this._tileComplete;
        },

        draw: function() {
            // if we're in between zoom levels, we need to choose the nearest:
            var baseZoom = Math.round(this.map.coordinate.zoom);

            // these are the top left and bottom right tile coordinates
            // we'll be loading everything in between:
            var startCoord = this.map.pointCoordinate(new MM.Point(0,0))
                .zoomTo(baseZoom).container();
            var endCoord = this.map.pointCoordinate(this.map.dimensions)
                .zoomTo(baseZoom).container().right().down();

            // tiles with invalid keys will be removed from visible levels
            // requests for tiles with invalid keys will be canceled
            // (this object maps from a tile key to a boolean)
            var validTileKeys = { };

            // make sure we have a container for tiles in the current level
            var levelElement = this.createOrGetLevel(startCoord.zoom);

            // use this coordinate for generating keys, parents and children:
            var tileCoord = startCoord.copy();

            for (tileCoord.column = startCoord.column;
                 tileCoord.column <= endCoord.column; tileCoord.column++) {
                for (tileCoord.row = startCoord.row;
                     tileCoord.row <= endCoord.row; tileCoord.row++) {
                    var validKeys = this.inventoryVisibleTile(levelElement, tileCoord);

                    while (validKeys.length) {
                        validTileKeys[validKeys.pop()] = true;
                    }
                }
            }

            // i from i to zoom-5 are levels that would be scaled too big,
            // i from zoom + 2 to levels. length are levels that would be
            // scaled too small (and tiles would be too numerous)
            for (var name in this.levels) {
                if (this.levels.hasOwnProperty(name)) {
                    var zoom = parseInt(name,10);

                    if (zoom >= startCoord.zoom-5 && zoom < startCoord.zoom+2) {
                        continue;
                    }

                    var level = this.levels[name];
                    level.style.display = 'none';
                    var visibleTiles = this.tileElementsInLevel(level);

                    while (visibleTiles.length) {
                        this.provider.releaseTile(visibleTiles[0].coord);
                        this.requestManager.clearRequest(visibleTiles[0].coord.toKey());
                        level.removeChild(visibleTiles[0]);
                        visibleTiles.shift();
                    }
                }
            }

            // levels we want to see, if they have tiles in validTileKeys
            var minLevel = startCoord.zoom - 5;
            var maxLevel = startCoord.zoom + 2;

            for (var z = minLevel; z < maxLevel; z++) {
                this.adjustVisibleLevel(this.levels[z], z, validTileKeys);
            }

            // cancel requests that aren't visible:
            this.requestManager.clearExcept(validTileKeys);

            // get newly requested tiles, sort according to current view:
            this.requestManager.processQueue(this.getCenterDistanceCompare());

            // make sure we don't have too much stuff:
            this.checkCache();
        },

        /**
         * For a given tile coordinate in a given level element, ensure that it's
         * correctly represented in the DOM including potentially-overlapping
         * parent and child tiles for pyramid loading.
         *
         * Return a list of valid (i.e. loadable?) tile keys.
         */
        inventoryVisibleTile: function(layer_element, tile_coord) {
            var tile_key = tile_coord.toKey(),
                valid_tile_keys = [tile_key];

            /*
             * Check that the needed tile already exists someplace - add it to the DOM if it does.
             */
            if (tile_key in this.tiles) {
                var tile = this.tiles[tile_key];

                // ensure it's in the DOM:
                if (tile.parentNode != layer_element) {
                    layer_element.appendChild(tile);
                    // if the provider implements reAddTile(), call it
                    if ("reAddTile" in this.provider) {
                        this.provider.reAddTile(tile_key, tile_coord, tile);
                    }
                }

                return valid_tile_keys;
            }

            /*
             * Check that the needed tile has even been requested at all.
             */
            if (!this.requestManager.hasRequest(tile_key)) {
                var tileToRequest = this.provider.getTile(tile_coord);
                if (typeof tileToRequest == 'string') {
                    this.addTileImage(tile_key, tile_coord, tileToRequest);
                // tile must be truish
                } else if (tileToRequest) {
                    this.addTileElement(tile_key, tile_coord, tileToRequest);
                }
            }

            // look for a parent tile in our image cache
            var tileCovered = false;
            var maxStepsOut = tile_coord.zoom;

            for (var pz = 1; pz <= maxStepsOut; pz++) {
                var parent_coord = tile_coord.zoomBy(-pz).container();
                var parent_key = parent_coord.toKey();

                if (this.enablePyramidLoading) {
                    // mark all parent tiles valid
                    valid_tile_keys.push(parent_key);
                    var parentLevel = this.createOrGetLevel(parent_coord.zoom);

                    //parentLevel.coordinate = parent_coord.copy();
                    if (parent_key in this.tiles) {
                        var parentTile = this.tiles[parent_key];
                        if (parentTile.parentNode != parentLevel) {
                            parentLevel.appendChild(parentTile);
                        }
                    } else if (!this.requestManager.hasRequest(parent_key)) {
                        // force load of parent tiles we don't already have
                        var tileToAdd = this.provider.getTile(parent_coord);

                        if (typeof tileToAdd == 'string') {
                            this.addTileImage(parent_key, parent_coord, tileToAdd);
                        } else {
                            this.addTileElement(parent_key, parent_coord, tileToAdd);
                        }
                    }
                } else {
                    // only mark it valid if we have it already
                    if (parent_key in this.tiles) {
                        valid_tile_keys.push(parent_key);
                        tileCovered = true;
                        break;
                    }
                }
            }

            // if we didn't find a parent, look at the children:
            if(!tileCovered && !this.enablePyramidLoading) {
                var child_coord = tile_coord.zoomBy(1);

                // mark everything valid whether or not we have it:
                valid_tile_keys.push(child_coord.toKey());
                child_coord.column += 1;
                valid_tile_keys.push(child_coord.toKey());
                child_coord.row += 1;
                valid_tile_keys.push(child_coord.toKey());
                child_coord.column -= 1;
                valid_tile_keys.push(child_coord.toKey());
            }

            return valid_tile_keys;
        },

        tileElementsInLevel: function(level) {
            // this is somewhat future proof, we're looking for DOM elements
            // not necessarily <img> elements
            var tiles = [];
            for(var tile = level.firstChild; tile; tile = tile.nextSibling) {
                if(tile.nodeType == 1) {
                    tiles.push(tile);
                }
            }
            return tiles;
        },

        /**
         * For a given level, adjust visibility as a whole and discard individual
         * tiles based on values in valid_tile_keys from inventoryVisibleTile().
         */
        adjustVisibleLevel: function(level, zoom, valid_tile_keys) {
            // for tracking time of tile usage:
            var now = new Date().getTime();

            if (!level) {
                // no tiles for this level yet
                return;
            }

            var scale = 1;
            var theCoord = this.map.coordinate.copy();

            if (level.childNodes.length > 0) {
                level.style.display = 'block';
                scale = Math.pow(2, this.map.coordinate.zoom - zoom);
                theCoord = theCoord.zoomTo(zoom);
            } else {
                level.style.display = 'none';
            }

            var tileWidth = this.map.tileSize.x * scale;
            var tileHeight = this.map.tileSize.y * scale;
            var center = new MM.Point(this.map.dimensions.x/2, this.map.dimensions.y/2);
            var tiles = this.tileElementsInLevel(level);

            while (tiles.length) {
                var tile = tiles.pop();

                if (!valid_tile_keys[tile.id]) {
                    this.provider.releaseTile(tile.coord);
                    this.requestManager.clearRequest(tile.coord.toKey());
                    level.removeChild(tile);
                }
                // log last-touched-time of currently cached tiles
                this.recentTilesById[tile.id].lastTouchedTime = now;
            }

            // position tiles
            MM.moveElement(level, {
                x: Math.round(center.x - (theCoord.column * tileWidth)),
                y: Math.round(center.y - (theCoord.row * tileHeight)),
                scale: scale,
                // TODO: pass only scale or only w/h
                // width: this.map.tileSize.x,
                width: Math.pow(2, theCoord.zoom) * this.map.tileSize.x,
                height: Math.pow(2, theCoord.zoom) * this.map.tileSize.y
            });
        },

        createOrGetLevel: function(zoom) {
            if (zoom in this.levels) {
                return this.levels[zoom];
            }

            //console.log('creating level ' + zoom);
            var level = document.createElement('div');
            level.id = this.parent.id+'-zoom-'+zoom;
            level.style.cssText = this.parent.style.cssText;
            level.style.zIndex = zoom;
            this.parent.appendChild(level);
            this.levels[zoom] = level;
            return level;
        },

        addTileImage: function(key, coord, url) {
            this.requestManager.requestTile(key, coord, url);
        },

        addTileElement: function(key, coordinate, element) {
            // Expected in draw()
            element.id = key;
            element.coord = coordinate.copy();

            // cache the tile itself:
            this.tiles[key] = element;
            this.tileCacheSize++;

            // also keep a record of when we last touched this tile:
            var record = {
                id: key,
                lastTouchedTime: new Date().getTime()
            };
            this.recentTilesById[key] = record;
            this.recentTiles.push(record);

            this.positionTile(element);
        },

        positionTile: function(tile) {
            //console.info(tile);
            // position this tile (avoids a full draw() call):
            var theCoord = this.map.coordinate.zoomTo(tile.coord.zoom);

            // Start tile positioning and prevent drag for modern browsers
            tile.style.cssText = 'position:absolute;-webkit-user-select: none;-webkit-user-drag: none;-moz-user-drag: none;';

            // Prevent drag for IE
            tile.ondragstart = function() { return false; };

            var tx = tile.coord.column *
                this.map.tileSize.x;
            var ty = tile.coord.row *
                this.map.tileSize.y;

            // TODO: pass only scale or only w/h
            MM.moveElement(tile, {
                x: Math.round(tx),
                y: Math.round(ty),
                width: this.map.tileSize.x,
                height: this.map.tileSize.y
            });

            // add tile to its level
            var theLevel = this.levels[tile.coord.zoom];
            theLevel.appendChild(tile);

            // Support style transition if available.
            tile.className += ' map-tile-loaded';

            // ensure the level is visible if it's still the current level
            if (Math.round(this.map.coordinate.zoom) == tile.coord.zoom) {
                theLevel.style.display = 'block';
            }

            // request a lazy redraw of all levels
            // this will remove tiles that were only visible
            // to cover this tile while it loaded:
            this.requestRedraw();
        },

        _redrawTimer: undefined,

        requestRedraw: function() {
            // we'll always draw within 1 second of this request,
            // sometimes faster if there's already a pending redraw
            // this is used when a new tile arrives so that we clear
            // any parent/child tiles that were only being displayed
            // until the tile loads at the right zoom level
            if (!this._redrawTimer) {
                this._redrawTimer = setTimeout(this.getRedraw(), 1000);
            }
        },

        _redraw: null,

        getRedraw: function() {
            // let's only create this closure once...
            if (!this._redraw) {
                var theLayer = this;
                this._redraw = function() {
                    theLayer.draw();
                    theLayer._redrawTimer = 0;
                };
            }
            return this._redraw;
        },

        // keeps cache below max size
        // (called every time we receive a new tile and add it to the cache)
        checkCache: function() {
            var numTilesOnScreen = this.parent.getElementsByTagName('img').length;
            var maxTiles = Math.max(numTilesOnScreen, this.maxTileCacheSize);

            if (this.tileCacheSize > maxTiles) {
                // sort from newest (highest) to oldest (lowest)
                this.recentTiles.sort(function(t1, t2) {
                    return t2.lastTouchedTime < t1.lastTouchedTime ? -1 :
                      t2.lastTouchedTime > t1.lastTouchedTime ? 1 : 0;
                });
            }

            while (this.tileCacheSize > maxTiles) {
            //while (this.recentTiles.length && this.tileCacheSize > maxTiles) {
                // delete the oldest record
                var tileRecord = this.recentTiles.pop();
                var now = new Date().getTime();
                delete this.recentTilesById[tileRecord.id];
                //window.console.log('removing ' + tileRecord.id +
                //                   ' last seen ' + (now-tileRecord.lastTouchedTime) + 'ms ago');
                // now actually remove it from the cache...
                var tile = this.tiles[tileRecord.id];
                if (tile.parentNode) {
                    // I'm leaving this uncommented for now but you should never see it:
                    //alert("Gah: trying to removing cached tile even though it's still in the DOM");
                    console.error("Gah: trying to removing cached tile even though it's still in the DOM");
                } else {
                    delete this.tiles[tileRecord.id];
                    this.tileCacheSize--;
                }
            }
        },

        setProvider: function(newProvider) {
            var firstProvider = (this.provider === null);

            // if we already have a provider the we'll need to
            // clear the DOM, cancel requests and redraw
            if (!firstProvider) {
                this.requestManager.clear();

                for (var name in this.levels) {
                    if (this.levels.hasOwnProperty(name)) {
                        var level = this.levels[name];

                        while (level.firstChild) {
                            this.provider.releaseTile(level.firstChild.coord);
                            level.removeChild(level.firstChild);
                        }
                    }
                }
            }

            // first provider or not we'll init/reset some values...

            this.tiles = {};
            this.tileCacheSize = 0;
            this.maxTileCacheSize = 1024;
            this.recentTilesById = {};
            this.recentTiles = [];

            // for later: check geometry of old provider and set a new coordinate center
            // if needed (now? or when?)

            this.provider = newProvider;

            if (!firstProvider) {
                this.draw();
            }
        },

        // compares manhattan distance from center of
        // requested tiles to current map center
        // NB:- requested tiles are *popped* from queue, so we do a descending sort
        getCenterDistanceCompare: function() {
            var theCoord = this.map.coordinate.zoomTo(Math.round(this.map.coordinate.zoom));

            return function(r1, r2) {
                if (r1 && r2) {
                    var c1 = r1.coord;
                    var c2 = r2.coord;
                    if (c1.zoom == c2.zoom) {
                        var ds1 = Math.abs(theCoord.row - c1.row - 0.5) +
                                  Math.abs(theCoord.column - c1.column - 0.5);
                        var ds2 = Math.abs(theCoord.row - c2.row - 0.5) +
                                  Math.abs(theCoord.column - c2.column - 0.5);
                        return ds1 < ds2 ? 1 : ds1 > ds2 ? -1 : 0;
                    } else {
                        return c1.zoom < c2.zoom ? 1 : c1.zoom > c2.zoom ? -1 : 0;
                    }
                }
                return r1 ? 1 : r2 ? -1 : 0;
            };
        },

        // Remove this layer from the DOM, cancel all of its requests
        // and unbind any callbacks that are bound to it.
        destroy: function() {
            this.requestManager.clear();
            this.requestManager.removeCallback('requestcomplete', this.getTileComplete());
            // TODO: does requestManager need a destroy function too?
            this.provider = null;
            // If this layer was ever attached to the DOM, detach it.
            if (this.parent.parentNode) {
              this.parent.parentNode.removeChild(this.parent);
            }
            this.map = null;
        }

    };

    var HAS_HASHCHANGE = (function() {
        var doc_mode = window.documentMode;
        return ('onhashchange' in window) &&
            (doc_mode === undefined || doc_mode > 7);
    })();

    MM.JSONHash = function(map) {
        this.onMapMove = MM.bind(this.onMapMove, this);
        this.onHashChange = MM.bind(this.onHashChange, this);
        if (map) {
            this.init(map);
        }
    };

    MM.JSONHash.prototype = {
        map: null,
        lastHash: null,
        currentLayer: null,

        parseHash: function(hash) {
            var args = hash.split("/");
            if (args.length == 3) {
                var zoom = parseInt(args[0], 10),
                    lat = parseFloat(args[1]),
                    lon = parseFloat(args[2]);
                if (isNaN(zoom) || isNaN(lat) || isNaN(lon)) {
                    return false;
                } else {
                    return {
                        center: new MM.Location(lat, lon),
                        zoom: zoom
                    };
                }
            } if (args.length == 4) {
                var layer = args[0],
                    zoom = parseInt(args[1], 10),
                    lat = parseFloat(args[2]),
                    lon = parseFloat(args[3]);
                if (isNaN(layer) || isNaN(zoom) || isNaN(lat) || isNaN(lon)) {
                    return false;
                } else {
                    return {
                        layer: layer,
                        center: new MM.Location(lat, lon),
                        zoom: zoom
                    };
                }
            } else {
                return false;
            }
        },

        formatHash: function(map) {
            var layer = this.currentLayer,
                center = map.getCenter(),
                zoom = map.getZoom(),
                precision = Math.max(0, Math.ceil(Math.log(zoom) / Math.LN2));
            if (layer && layer.length > 0) {
                return "#" + [layer, zoom,
                    center.lat.toFixed(precision),
                    center.lon.toFixed(precision)
                ].join("/");
            }  else {
                return "#" + [zoom,
                    center.lat.toFixed(precision),
                    center.lon.toFixed(precision)
                ].join("/");
            }
        },

        init: function(map) {
            this.map = map;
            this.map.addCallback("drawn", this.onMapMove);
            // reset the hash
            this.lastHash = null;
            this.onHashChange();

            if (!this.isListening) {
                this.startListening();
            }
        },

        remove: function() {
            this.map = null;
            if (this.isListening) {
                this.stopListening();
            }
        },

        onMapMove: function(map) {
            // bail if we're moving the map (updating from a hash),
            // or if the map has no zoom set
            if (this.movingMap || this.map.zoom === 0) {
                return false;
            }
            var hash = this.formatHash(map);
            if (this.lastHash != hash) {
                location.replace(hash);
                this.lastHash = hash;
            }
        },

        movingMap: false,
        update: function() {
            var hash = location.hash;
            if (hash === this.lastHash) {
                // console.info("(no change)");
                return;
            }
            var sansHash = hash.substr(1),
                parsed = this.parseHash(sansHash);
            if (parsed) {
                // console.log("parsed:", parsed.zoom, parsed.center.toString());
                this.movingMap = true;
                this.map.setCenterZoom(parsed.center, parsed.zoom);
                this.movingMap = false;
                if(parsed.layer != this.currentLayer) {
                    this.currentLayer = parsed.layer;
                    updateJSONLayer();
                }
            } else {
                // console.warn("parse error; resetting:", this.map.getCenter(), this.map.getZoom());
                this.onMapMove(this.map);
            }
        },

        // defer hash change updates every 100ms
        changeDefer: 100,
        changeTimeout: null,
        onHashChange: function() {
            // throttle calls to update() so that they only happen every
            // `changeDefer` ms
            if (!this.changeTimeout) {
                var that = this;
                this.changeTimeout = setTimeout(function() {
                    that.update();
                    that.changeTimeout = null;
                }, this.changeDefer);
            }
        },

        isListening: false,
        hashChangeInterval: null,
        startListening: function() {
            if (HAS_HASHCHANGE) {
                window.addEventListener("hashchange", this.onHashChange, false);
            } else {
                clearInterval(this.hashChangeInterval);
                this.hashChangeInterval = setInterval(this.onHashChange, 50);
            }
            this.isListening = true;
        },

        stopListening: function() {
            if (HAS_HASHCHANGE) {
                window.removeEventListener("hashchange", this.onHashChange);
            } else {
                clearInterval(this.hashChangeInterval);
            }
            this.isListening = false;
        }
    };
})(com.modestmaps);
