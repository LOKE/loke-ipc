var pubsub = require('../lib/pubsub');
var sinon = require('sinon');
var q = require('q');
require('should');

var subscriber, _bindQueue, _unbindQueue;

beforeEach(function () {
  subscriber = new pubsub.Subscriber({});
  _bindQueue = sinon.stub(subscriber, '_bindQueue')
  .returns(q.when());

  _unbindQueue = sinon.stub(subscriber, '_unbindQueue')
  .returns(q.when());

});

afterEach(function () {
  _bindQueue.reset();
  _unbindQueue.reset();
});

describe('Subscriber', function () {
  describe('#subscribe()', function () {

    it('should create a subscription to an exact key', function (done) {
      var handler = new sinon.spy();

      subscriber.subscribe('some.key', handler)
      .then(function() {

        subscriber._handleMsg({
          content: '{}',
          fields: {
            routingKey: 'some.key'
          }
        });

        subscriber._handleMsg({
          content: '{}',
          fields: {
            routingKey: 'some.other.key'
          }
        });

        handler.calledOnce.should.eql(true);

      }).done(done);
    });

    it('should create a subscription to an * pattern key', function (done) {
      var handler = new sinon.spy();

      subscriber.subscribe('some.*.key', handler)
      .then(function() {


        subscriber._handleMsg({
          content: '{}',
          fields: {
            routingKey: 'some.other.key'
          }
        });

        subscriber._handleMsg({
          content: '{}',
          fields: {
            routingKey: 'some.four.word.key'
          }
        });

        handler.calledOnce.should.eql(true);

      }).done(done);
    });

    it('should create a subscription to an # pattern key', function (done) {
      var handler = new sinon.spy();

      subscriber.subscribe('some.#', handler)
      .then(function() {


        subscriber._handleMsg({
          content: '{}',
          fields: {
            routingKey: 'some.key'
          }
        });

        subscriber._handleMsg({
          content: '{}',
          fields: {
            routingKey: 'some.four.word.key'
          }
        });

        handler.calledTwice.should.eql(true);

      }).done(done);
    });

    it('should let all relevent subscriptions match a message', function (done) {
      var handler1 = new sinon.spy();
      var handler2 = new sinon.spy();
      var handler3 = new sinon.spy();
      var handler4 = new sinon.spy();
      var handler5 = new sinon.spy();

      q.all(
        subscriber.subscribe('some.#.key', handler1),
        subscriber.subscribe('some.#', handler2),
        subscriber.subscribe('some.*.word.key', handler3),
        subscriber.subscribe('some.four.word.key', handler4),
        subscriber.subscribe('four.word.key.*', handler5),
        subscriber.subscribe('four.word.key.#', handler5),
        subscriber.subscribe('four.word.key.boom', handler5)
      )
      .then(function() {

        subscriber._handleMsg({
          content: '{}',
          fields: {
            routingKey: 'some.four.word.key'
          }
        });

        handler1.calledOnce.should.eql(true);
        handler2.calledOnce.should.eql(true);
        handler3.calledOnce.should.eql(true);
        handler4.calledOnce.should.eql(true);
        handler5.called.should.eql(false);

      }).done(done);
    });
  });

  describe('#subscribeOnce()', function () {

    it('should only fire once', function (done) {
      var handler = new sinon.spy();

      subscriber.subscribeOnce('some.key', handler)
      .then(function () {

        var msg = {
          content: '{}',
          fields: {
            routingKey: 'some.key'
          }
        };

        subscriber._handleMsg(msg);
        subscriber._handleMsg(msg);

        sinon.assert.callCount(handler, 1);

      }).done(done);
    });
  });

  describe('#unsubscribe()', function () {

    it('should only unsubscribe itself (exact)', function (done) {
      var handler1 = new sinon.spy();
      var handler2 = new sinon.spy();

      q.all([
        subscriber.subscribe('some.key', handler1),
        subscriber.subscribe('some.key', handler2)
      ])
      .then(function (results) {
        return results[1].destroy();
      })
      .then(function () {

        var msg = {
          content: '{}',
          fields: {
            routingKey: 'some.key'
          }
        };

        subscriber._handleMsg(msg);

        sinon.assert.callCount(handler1, 1);
        sinon.assert.callCount(handler2, 0);
        // sinon.assert.callCount(_bindQueue, 1);
        sinon.assert.callCount(_unbindQueue, 0);

      }).done(done);
    });

    it('should only unsubscribe itself (pattern)', function (done) {
      var handler1 = new sinon.spy();
      var handler2 = new sinon.spy();

      q.all([
        subscriber.subscribe('some.*', handler1),
        subscriber.subscribe('some.*', handler2)
      ])
      .then(function (results) {
        return results[1].destroy();
      })
      .then(function () {

        var msg = {
          content: '{}',
          fields: {
            routingKey: 'some.key'
          }
        };

        subscriber._handleMsg(msg);

        sinon.assert.callCount(handler1, 1);
        sinon.assert.callCount(handler2, 0);
        // sinon.assert.callCount(_bindQueue, 1);
        sinon.assert.callCount(_unbindQueue, 0);

      }).done(done);
    });

    it('should unbind on last unsubscribe', function (done) {
      var handler1 = new sinon.spy();
      var handler2 = new sinon.spy();

      q.all([
        subscriber.subscribe('some.*', handler1),
        subscriber.subscribe('some.*', handler2)
      ])
      .then(function (results) {
        return q.all([
          results[0].destroy(),
          results[0].destroy(),
          results[1].destroy()
        ]);
      })
      .then(function () {
        if (subscriber._keycount['some.*'] !== 0) {
          throw new Error('should\'t go negative');
        }
        sinon.assert.callCount(_unbindQueue, 1);
      }).done(done);
    });
  });
});
