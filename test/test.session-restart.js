var server = require('../lib/unhangout-server'),
    models = require("../lib/server-models"),
	expect = require('expect.js'),
	_ = require('underscore'),
    sinon = require('sinon'),
    sync = require("../lib/redis-sync"),
    common = require('./common');



var participants = [{id: 1, displayName: "Fun"}, {id: 2, displayName: "Times"}];

describe('SESSION RESTART', function() {
    beforeEach(function() {
        sync.setPersist(false);
    });
    it("Removes connected participants on restart", function() {
        var session = new models.ServerSession({connectedParticipants: participants});
        session.onRestart();
        expect(session.getNumConnectedParticipants()).to.be(0);
    });

    it("Removes hangout-url after a timeout after restart", function() {
        var session = new models.ServerSession({
            connectedParticipants: participants,
            "hangout-url": "http://example.com"
        });

        var clock = sinon.useFakeTimers();
        session.onRestart()
        clock.tick(session.RESTART_HANGOUT_URL_EXPIRATION_TIMEOUT + 1);
        expect(session.get("hangout-url")).to.be(null);
        clock.restore();
    });

    it("Does not remove hangout-url if participants join before timeout", function() {
        var session = new models.ServerSession({
            connectedParticipants: participants,
            "hangout-url": "http://example.com"
        });

        var clock = sinon.useFakeTimers();
        session.onRestart();
        clock.tick(session.RESTART_HANGOUT_URL_EXPIRATION_TIMEOUT - 1);
        session.setConnectedParticipants(participants);
        clock.tick(session.RESTART_HANGOUT_URL_EXPIRATION_TIMEOUT);
        expect(session.get("hangout-url")).to.be("http://example.com");
        clock.restore();
    });

    it("Calculates total seconds active", function() {
        var session = new models.ServerSession();

        var clock = sinon.useFakeTimers();

        session.onHangoutStarted();
        clock.tick(10000);
        session.onHangoutStopped();

        expect(session.get("total-seconds")).to.be(10);
        expect(session.get("hangout-start-time")).to.be(null);

        session.onHangoutStarted();
        clock.tick(10000);
        session.onHangoutStopped();

        expect(session.get("total-seconds")).to.be(20);
        expect(session.get("hangout-start-time")).to.be(null);

        expect(session.get("total-instances")).to.be(2);

        clock.restore();
    });

    it("Continues counting after restart", function() {
        var clock = sinon.useFakeTimers();
        var start = new Date().getTime();
        clock.tick(10000);
        var session = new models.ServerSession({
            "total-instances": 1,
            "hangout-start-time": start
        });
        clock.tick(10000);
        session.onHangoutStopped();

        expect(session.get("total-seconds")).to.be(20);
        // No new instance for a re-start.
        expect(session.get("total-instances")).to.be(1);

        clock.restore();
    });

    it("Interprets state as expected", function() {
        function expectState(state, params) {
            var session = new models.ServerSession(params);
            expect(session.getState()).to.eql(state);
        }
        expectState("started", {
            connectedParticipants: [{id: 1, displayName: "foo"}],
            "hangout-start-time": 10,
            "hangout-url": "http://example.com"
        });
        expectState("stopped", {
            connectedParticipants: [],
            "hangout-start-time": null,
            "hangout-url": null
        });
        expectState("unstopped", {
            connectedParticipants: [],
            "hangout-start-time": 10,
            "hangout-url": null
        });
        expectState("stale url", {
            connectedParticipants: [],
            "hangout-start-time": null,
            "hangout-url": "http://example.com"
        });
        expectState("stale url; unstopped", {
            connectedParticipants: [],
            "hangout-start-time": 10,
            "hangout-url": "http://example.com"
        });
    });
});
