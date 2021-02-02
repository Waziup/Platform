let chai = require('chai');
let chaiHttp = require('chai-http');
let should = chai.should();
let expect = chai.expect;
let device = require('../devices/sample-data').valid;
let sensor = require('../devices/sample-data').valid.sensors[0];
let actuator = require('../devices/sample-data').valid.actuators[0];
let mqttUrl = require('../../config/env').mqttUrl;
let utils = require('../utils');

const mqtt = require('mqtt');
const MQTT = require("async-mqtt");
const { getAdminAuth, getNormalAuth,
  createDevice,
  deleteDevice,
  createSensor,
  getSensor,
  getDevice,
  pushSensorValue,
  createActuator,
  setActuatorValue,
  getActuator
} = require('../utils');

chai.use(chaiHttp);
chai.config.includeStack = true;

let connect = function (connId) {
  let connectedPromise = new Promise(
      function (resolve, reject) {
          var client = MQTT.connect(mqttUrl, {clientId: connId}); 
          client.on('connect', () => { resolve(client) })
      });
  return connectedPromise;
}

let connectLogin = function (connId) {
  let connectedPromise = new Promise(
      function (resolve, reject) {
          var client = MQTT.connect(mqttUrl, {clientId: connId, username: "cdupont", password: "password"}); 
          client.on('connect', () => { resolve(client) })
      });
  return connectedPromise;
}


describe('MQTT', () => {
  let withAdmin = null
  let withNormal = null

  //Retrieve the tokens and delete pre-existing device
  before(async function () {
    try {
      withAdmin = await getAdminAuth();
      withNormal = await getNormalAuth();
      await deleteDevice(device.id).set(withAdmin);
    } catch (err) {
      console.log('error:' + err)
    }
  });

  beforeEach(async function () {
    try {
    } catch (err) {
      console.log('error:' + err)
      throw err;
    }
  });
  //Clean after each test
  afterEach(async function () {
    try {
      await deleteDevice(device.id).set(withAdmin);
    } catch (err) {
      console.log('error:' + err)
      throw err;
    }
  });
 
  describe('Test PUBLISH', () => {

    it('admin can publish to existing sensor', async () => {
      const value = { "value": "55.6", "timestamp": "2016-06-08T18:20:27Z" };
      //create the device  
      await createDevice(device).set(withNormal)
      //The connect should be always AFTER device creation. This is because the permissions on all devices are collected during the connect.
      let client = await connectLogin()
      //await sleep(1 * 70 * 1000) //1 min
      //publish the value
      await client.publish(`devices/${device.id}/sensors/TC1/value`, JSON.stringify(value), { qos: 1 })
      //get the result
      let res2 = await getSensor(sensor.id).set(withAdmin);
      res2.body.value.should.deep.include(value);
      res2.body.value.should.have.property('date_received');
      client.end();
    });
  
    it('Normal user CANNOT publish to private sensor', async () => {
      const value = { "value": "55.6", "timestamp": "2016-06-08T18:20:27Z" };
      //create the device in private 
      await createDevice({ ...device, visibility: 'private' }).set(withAdmin)
      //The connect should be always AFTER device creation. This is because the permissions on all devices are collected during the connect.
      let client = await connect()
      //publish the value
      await client.publish(`devices/${device.id}/sensors/TC1/value`, JSON.stringify(value), { qos: 1 })
      //get the result
      let res2 = await getSensor(sensor.id).set(withAdmin);
      res2.body.should.not.have.property("value");
      client.end();
    });
  });

  describe('Test SUBSCRIBE', () => { 
    it('Normal user can subscribe on existing sensor and receive published values', async () => {
      let data = null
      let count = 0;
      const value = { "value": "56.6", "timestamp": "2016-06-08T18:20:27Z" };
      //Create the device
      await createDevice(device).set(withNormal)
      //Connect
      let mqttClient = await connect();
      //register callback
      mqttClient.on('message', function (topic, message) {data = message;});
      //subscribe
      await mqttClient.subscribe(`devices/${device.id}/sensors/${sensor.id}/value`)
      //publish a value
      await mqttClient.publish(`devices/${device.id}/sensors/${sensor.id}/value`, JSON.stringify(value), { qos: 1 })
      //wait for the subscription trigger
      while (data == null && count <20) {await sleep(100); count++}
      //Check the result
      const res = JSON.parse(data.toString());
      res.should.deep.include(value);
      mqttClient.end();
    });

    it('Normal user can subscribe on existing sensor and receive posted values', async () => {
      let data = null; 
      let count = 0;
      const value = { "value": "56.6", "timestamp": "2016-06-08T18:20:27Z" };
      //Create the device
      await createDevice(device).set(withNormal)
      //Connect
      let mqttClient = await connect();
      //register callback
      mqttClient.on('message', function (topic, message) {data = message;});
      //subscribe
      await mqttClient.subscribe(`devices/${device.id}/sensors/TC1/value`)
      //post a value
      await pushSensorValue(sensor.id, value).set(withNormal);
      //wait for the subscription trigger
      while (data == null && count <20) {await sleep(100); count++}
      //Check the result
      const res = JSON.parse(data.toString());
      res.should.deep.include(value);
      mqttClient.end();
    });

    it('Normal user can subscribe with wildcard', async () => {
      let data = null; 
      let count = 0;
      const value = { "value": "56.6", "timestamp": "2016-06-08T18:20:27Z" };
      //Create the device
      await createDevice(device).set(withNormal)
      //Connect
      let mqttClient = await connect();
      //register callback
      mqttClient.on('message', function (topic, message) {data = message;});
      //subscribe
      await mqttClient.subscribe(`devices/+/sensors/${sensor.id}/value`)
      //publish a value
      await mqttClient.publish(`devices/${device.id}/sensors/${sensor.id}/value`, JSON.stringify(value), { qos: 1 })
      //wait for the subscription trigger
      while (data == null && count <20) {await sleep(100); count++}
      //Check the result
      const res = JSON.parse(data.toString());
      res.should.deep.include(value);
      mqttClient.end();
    });

    it('Normal user can subscribe on private sensor but will NOT receive posted values', async () => {
      let data = null; 
      let count = 0;
      const value = { "value": "56.6", "timestamp": "2016-06-08T18:20:27Z" };
      //create the device in private 
      await createDevice({ ...device, visibility: 'private' }).set(withAdmin)
      //Connect
      let mqttClient = await connect();
      //register callback
      mqttClient.on('message', function (topic, message) {data = message;});
      //subscribe
      await mqttClient.subscribe(`devices/${device.id}/sensors/TC1/value`)
      //post a value
      await pushSensorValue(sensor.id, value).set(withAdmin);
      //wait for the subscription trigger
      while (data == null && count <20) {await sleep(100); count++}
      //Check the result
      chai.assert(data == null);
      mqttClient.end();
    });

    it('Normal user can subscribe on existing actuator and receive published values', async () => {
      let data = null
      let count = 0;
      const value = "50";
      //Create the device
      await createDevice(device).set(withNormal)
      //Connect
      let mqttClient = await connect();
      //register callback
      mqttClient.on('message', function (topic, message) {data = message;});
      //subscribe
      await mqttClient.subscribe(`devices/${device.id}/actuators/${actuator.id}/value`)
      //publish a value
      await mqttClient.publish(`devices/${device.id}/actuators/${actuator.id}/value`, value, { qos: 1 })
      //wait for the subscription trigger
      while (data == null && count <20) {await sleep(100); count++}
      //Check the result
      chai.assert(data == value);
      mqttClient.end();
    });

    it('Normal user can subscribe on existing actuator and receive posted values', async () => {
      let data = null; 
      let count = 0;
      const value = 56.6;
      //Create the device
      await createDevice(device).set(withNormal)
      //Connect
      let mqttClient = await connect();
      //register callback
      mqttClient.on('message', function (topic, message) {data = message;});
      //subscribe
      await mqttClient.subscribe(`devices/${device.id}/actuators/${actuator.id}/value`)
      //post a value
      await setActuatorValue(device.id, actuator.id, value).set(withNormal);
      //wait for the subscription trigger
      while (data == null && count <20) {await sleep(100); count++}
      //Check the result
      const res = JSON.parse(data.toString());
      res.should.equal(value);
      mqttClient.end();
    });
  });
  
  describe('Test Gateway', () => { 
    it('A gateway can connect with its own ID', async () => {
      let data = null; 
      let count = 0;
       const gateway = {
           "name": "MyGateway",
           "id": "GW1",
           "visibility": "public"
       };
      //create a gateway 
      await utils.createGateway(gateway).set(withAdmin)
      //Connect
      let mqttClient = await connect("GW1");
      await sleep(1000) 
      let res = await utils.getGateway("GW1").set(withAdmin)
      res.body.should.have.property('connected').eql(true);
      mqttClient.end();
      await sleep(1000) 
      res = await utils.getGateway("GW1").set(withAdmin)
      res.body.should.have.property('connected').eql(false);
    });
  });

});

function sleep(ms){
  return new Promise(resolve=>{
    setTimeout(resolve, ms)
  })
}

