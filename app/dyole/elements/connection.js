/**
 * Created by filip on 11.3.15..
 */
define([
        'jquery',
        'lodash',
        'dyole/helpers/common',
        '../constants/PathTypes'
    ],
    function($, _, Common, PathTypes) {

        var CONSTRAINTS = {
            baseUrl: '/',

            strokeWidth: 7,
            strokeColor: '#FBFCFC',
            labelColor : '#8989FF',
            disableWire: false,

            images: {
                wirePath: 'preview_assets/images/wire-cut.png'
            },

            pathType : PathTypes.BEIZER
        };

        var Connection = function(options) {

            this.constraints = _.clone(CONSTRAINTS);

            this.nodeViews = options.nodes;
            this.model = options.model;
            this.canvas = options.canvas;
            this.parent = options.parent;
            this.element = options.element;
            this.Pipeline = options.pipeline;

            this.input = options.input;
            this.output = options.output;

            this.baseUrl = this.Pipeline.assetsUrl;

            this.id = this.model.id;

            this._glowOptions = {};

//            this.tempConnectionActive = false;

            if (Common.checkObjectKeys(this.Pipeline.constraints.connection)) {
                Common.setConstraints(this.constraints, this.Pipeline.constraints.connection)
            }

            if (typeof options.constraints === 'object') {
                this.constraints = _.extend({}, this.constraints, options.constraints);
            }

            this._createConnection(this.input, this.output);
            this._attachEvents();
        };

        Connection.prototype = {

            _attachEvents: function() {

                var _self = this,
                    events = [], calcStroke, rmWire, conState;

                calcStroke = function() {
                    _self.draw();
                };

                rmWire = function() {
                    _self.removeWire();
                };

                conState = function(state) {
                    _self.tempConnectionActive = state;
                };

                if (this.Pipeline.editMode) {
                    this.connection.mouseover(this.onMouseOver, this);
                }

                this.Pipeline.Event.subscribe('connection:stroke:calculate', calcStroke);

                events.push({
                    event  : 'connection:stroke:calculate',
                    handler: calcStroke
                });

                this.Pipeline.Event.subscribe('remove:wire', rmWire);

                events.push({
                    event  : 'remove:wire',
                    handler: rmWire
                });

                this.Pipeline.Event.subscribe('temp:connection:state', conState);

                events.push({
                    event  : 'temp:connection:state',
                    handler: conState
                });

                // create pool of events to unsubscribe on destroy
                this.events = events;

            },

            _getOffset: function(element) {

                var bodyRect = document.body.getBoundingClientRect();
                var elemRect = element.getBoundingClientRect();
                var top = elemRect.top - bodyRect.top;
                var left = elemRect.left - bodyRect.left;

                return {top: top, left: left};
            },

            onMouseOver: function(e, x, y) {

                if (!this.Pipeline.tempConnectionActive && !this.constraints.disableWire) {

                    var self = this,
                        src = this.constraints.images.wirePath,
                        canvasOffset = this._getOffset(this.element[0]);

                    this.removeWire();

                    this.wire = this.canvas.image(this.constraints.baseUrl + src, x - canvasOffset.left - 15, y - canvasOffset.top - 15, 25, 25);

                    this.wire.click(function() {
                        self.removeWire();
                        self.destroyConnection();
                    });

                    this.wire.mouseout(this.onMouseOut, this);

                    this.startTime = Date.now();

                }

            },

            onMouseOut: function() {
                var diff = this.startTime - Date.now();

                if (this.wire && diff > 1000) {
                    this.wire.remove();
                } else {
                    this.removeWire();
                }
            },

            removeWire: function() {
                if (this.wire) {
                    this.wire.unclick();
                    this.wire.remove();
                }

                return this;
            },

            draw: function() {

                var coords, strokeWidth,
                    scale = this.parent.getScale().x;

                coords = this._getCoords(this.input, this.output);

                strokeWidth = this.constraints.strokeWidth * scale;


                this.connection.redraw(coords, strokeWidth);


                var totalLen = this.connection.getPathInner().getTotalLength();
                var labelCoords = this.connection.getPathInner().getPointAtLength(totalLen / 2);


                //console.log(labelCoords);

                if (this.connectionLabel) {
                    this.connectionLabel.attr({x: labelCoords.x, y: labelCoords.y});
                }

                this.removeWire();

                if (this._glow) {
                    this.reDrawGlow();
                } else {
                    this.removeGlow()
                }

                return this;
            },

            glow: function(options) {

                if (typeof options === 'object') {
                    this._glowOptions = options || this._glowOptions;
                } else {
                    console.error('[glow()] ', 'expected object, got : ', typeof options);
                }

                this._glow = this.connection.getPathOuter().glow(this._glowOptions);
                this.connection.push(this._glow);

                this._glow.toBack();

                return this;
            },

            removeGlow: function() {

                if (this._glow) {
                    this._glowOptions = {};
                    this._glow.remove();
                    this._glow = null;
                }

                return this;
            },

            reDrawGlow: function () {

                var opts = _.clone(this._glowOptions, true);
                this.removeGlow();
                this.glow(opts);

                return this;
            },

            _getCoords: function(input, output) {

                var inputCoords = input.el.node.getCTM(),
                    outputCoords = output.el.node.getCTM(),
                    parentTrans = this.parent.getTranslation(),
                    scale = this.parent.getScale().x;

                inputCoords.e = inputCoords.e / scale;
                inputCoords.f = inputCoords.f / scale;
                outputCoords.e = outputCoords.e / scale;
                outputCoords.f = outputCoords.f / scale;

                inputCoords.e -= parentTrans.x / scale;
                inputCoords.f -= parentTrans.y / scale;
                outputCoords.e -= parentTrans.x / scale;
                outputCoords.f -= parentTrans.y / scale;

                return {
                    x1: inputCoords.e,
                    x2: outputCoords.e,
                    y1: inputCoords.f,
                    y2: outputCoords.f
                };
            },

            _createConnection: function(input, output) {

                var attr, coords,
                    scale = this.parent.getScale().x;

                coords = this._getCoords(input, output);

                attr = {
                    stroke        : this.constraints.strokeColor,
                    'stroke-width': this.constraints.strokeWidth * scale
                };

                this.connection = this.canvas.curve(coords, attr, this.constraints.pathType);
                this.parent.push(this.connection.getPath());
//            this.connection.makeBorder({
//                stroke: '#c8c8c8',
//                'stroke-width': 4
//            });

                var totalLen = this.connection.getPathInner().getTotalLength();
                var labelCoords = this.connection.getPathInner().getPointAtLength(totalLen / 2);

                if (this.model.connection_name && this.model.connection_name !== '') {
                    this.connectionLabel = this.canvas.text(labelCoords.x, labelCoords.y, this.model.connection_name).attr({fill: this.constraints.labelColor});
                    this.connection.push(this.connectionLabel);
                }

                this.connection.toBack();

                input.addConnection(this.model.id);
                output.addConnection(this.model.id);

                input.setConnectedState();
                output.setConnectedState();

                input.terminals[output.model.id] = this.model.id;
                output.terminals[input.model.id] = this.model.id;
            },

            destroyConnection: function() {

                var inputCheck, outputCheck;

                this.connection.remove();

                this.Pipeline.nodes[this.model.start_node].removeConnection(this.model);
                this.Pipeline.nodes[this.model.end_node].removeConnection(this.model);

                inputCheck = this.input.removeConnection(this.model.id);
                outputCheck = this.output.removeConnection(this.model.id);

                this.input.terminals[this.output.model.id] = null;
                delete this.input.terminals[this.output.model.id];

                this.output.terminals[this.input.model.id] = null;
                delete this.output.terminals[this.input.model.id];

                if (this.connectionLabel) {
                    this.connectionLabel.remove();
                }

                if (!inputCheck) {
                    this.input.terminalConnected = false;
                    this.input.setDefaultState();
                }

                if (!outputCheck) {
                    this.output.terminalConnected = false;
                    this.output.setDefaultState();
                }


                this.Pipeline.Event.trigger('connection:remove');
                this.Pipeline.Event.trigger('connection:destroy');
                this.Pipeline.Event.trigger('pipeline:change');
            },

            destroy: function() {
                var _self = this;

                this.destroyConnection();

                _.each(this.events, function(ev) {
                    _self.Pipeline.Event.unsubscribe(ev.event, ev.handler);
                });
            }
        };

        return Connection;
    });
