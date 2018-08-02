const pubsub = require('../lib/pubsub');
const assert = require('assert');
const sinon = require('sinon');

let publisher;

beforeEach(() => {
  publisher = new pubsub.Publisher('test-service');
  publisher.ch = {
    publish: sinon.spy()
  };
});

describe('Publisher', () => {
  describe('#publish()', () => {
    it('should prepend event names with service prefix for routing key', () => {
      // ARRANGE

      // ACT
      publisher.publish('event.test', {});

      // ASSERT
      // eslint-disable-next-line no-unused-vars
      const [exchange, routingKey] = publisher.ch.publish.getCall(0).args;
      assert.strictEqual(routingKey, 'test-service.event.test');
    });

    it('should attach meta fields when no options are provided', () => {
      // ARRANGE

      // ACT
      publisher.publish('event.test', {});

      // ASSERT
      // eslint-disable-next-line no-unused-vars
      const [exchange, routingKey, message, options] = publisher.ch.publish.getCall(0).args;
      assert.strictEqual(typeof options.correlationId, 'string');
      assert.strictEqual(typeof options.messageId, 'string');
      assert.strictEqual(options.appId, 'test-service');
      assert.strictEqual(options.type, undefined);
      assert.strictEqual(options.contentType, 'application/json');
      assert.strictEqual(options.mandatory, false);
      assert.strictEqual(typeof options.timestamp, 'number');
    });

    it('should attach options to meta fields if provided', () => {
      // ARRANGE
      const timestamp = new Date('2000-01-01');

      // ACT
      publisher.publish('event.test', {}, { correlationId: 'cid2', appId: 'app2', type: 'type2', timestamp });

      // ASSERT
      // eslint-disable-next-line no-unused-vars
      const [exchange, routingKey, message, options] = publisher.ch.publish.getCall(0).args;
      assert.strictEqual(options.correlationId, 'cid2');
      assert.strictEqual(typeof options.messageId, 'string');
      assert.strictEqual(options.appId, 'app2');
      assert.strictEqual(options.type, 'type2');
      assert.strictEqual(options.contentType, 'application/json');
      assert.strictEqual(options.mandatory, false);
      assert.strictEqual(options.timestamp, timestamp.getTime());
    });
  });
});
