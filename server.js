const express = require('express');
const cors = require('cors');

//Multicast Client receiving sent messages
var PORT = 1235;
var MCAST_ADDR = '232.1.1.1'; //same mcast address as Server
var HOST = '0.0.0.0'; //this is your own IP
var dgram = require('dgram');
var client = dgram.createSocket('udp4');

let services = new Map();
let thingss = new Map();
let entities = new Map();
let relationships = new Map();

client.on('listening', function () {
	var address = client.address();
	console.log(
		'UDP Client listening on ' + address.address + ':' + address.port
	);
	client.setBroadcast(true);
	client.setMulticastTTL(128);
	client.addMembership(MCAST_ADDR);
});

client.on('message', function (message, remote) {
	var obj = JSON.stringify(message.toString());
	obj = obj.replace(/\\/g, '');
	var type = getTweetParameter('Tweet Type', obj);
	console.log('\n' + type);
	switch (type) {
		case 'Identity_Thing':
			if (thingss.has(obj)) {
				let temp = thingss.get(obj);
				temp.lastSeen = Date.now();
			} else {
				parseThing(obj);
			}
			break;
		case 'Service':
			if (services.has(obj)) {
				let temp = services.get(obj);
				temp.lastSeen = Date.now();
			} else {
				parseService(obj);
			}
			break;
		case 'Relationship':
			if (relationships.has(obj)) {
				let temp = relationships.get(obj);
				temp.lastSeen = Date.now();
			} else {
				parseRelationship(obj);
			}
			break;
		case 'Identity_Language':
			parseThingNetworkInfo(obj);
			break;
		case 'Identity_Entity':
			if (entities.has(obj)) {
				let temp = entities.get(obj);
				temp.lastSeen = Date.now();
			} else {
				parseEntity(obj);
			}
			break;
		default:
			break;
	}
});

client.bind(PORT, HOST);

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.listen(port, () => {
	console.log(`Server is running on port: ${port}`);
});

//<------------------ APIs --------------------------->
app.get('/getservices', (req, res) => {
	let ans = [];
	for (let value of services.values()) {
		if (value.lastSeen > Date.now() - 90000) ans.push(value);
	}
	res.json(ans);
});

app.get('/getthings', (req, res) => {
	let ans = [];
	for (let value of thingss.values()) {
		if (value.lastSeen > Date.now() - 90000) ans.push(value);
	}
	res.json(ans);
});

app.get('/getrelationships', (req, res) => {
	let ans = [];
	for (let value of relationships.values()) {
		if (value.lastSeen > Date.now() - 90000) ans.push(value);
	}
	res.json(ans);
});

//<------------------ Parsing Tweets ----------------->
function getTweetParameter(parameterName, tweet) {
	let i = tweet.indexOf(parameterName) + parameterName.length + 5;
	let j = tweet.substring(i).indexOf('"');
	return tweet.substring(i, i + j);
}

function parseThing(tweet) {
	var ans = {
		thingID: getTweetParameter('Thing ID', tweet),
		spaceID: getTweetParameter('Space ID', tweet),
		owner: getTweetParameter('Owner', tweet),
		description: getTweetParameter('Description', tweet),
		name: getTweetParameter('Name', tweet),
		model: getTweetParameter('Model', tweet),
		OS: getTweetParameter('OS', tweet),
		vendor: getTweetParameter('Vendor', tweet),
		lastSeen: Date.now(),
	};
	thingss.set(tweet, ans);
	//console.log(thingss);
}

function parseRelationship(tweet) {
	var ans = {
		thingID: getTweetParameter('Thing ID', tweet),
		spaceID: getTweetParameter('Space ID', tweet),
		name: getTweetParameter('Name', tweet),
		owner: getTweetParameter('Owner', tweet),
		category: getTweetParameter('Category', tweet),
		type: getTweetParameter('Type', tweet),
		description: getTweetParameter('Description', tweet),
		firstService: getTweetParameter('FS name', tweet),
		secondService: getTweetParameter('SS name', tweet),
		lastSeen: Date.now(),
	};
	relationships.set(tweet, ans);
}

function parseEntity(tweet) {
	var ans = {
		thingID: getTweetParameter('Thing ID', tweet),
		spaceID: getTweetParameter('Space ID', tweet),
		entityID: getTweetParameter('ID', tweet),
		owner: getTweetParameter('Owner', tweet),
		description: getTweetParameter('Description', tweet),
		name: getTweetParameter('Name', tweet),
		entityType: getTweetParameter('Type', tweet),
		vendor: getTweetParameter('Vendor', tweet),
		lastSeen: Date.now(),
	};
	entities.set(tweet, ans);
	//console.log(entities);
}

function parseService(tweet) {
	var ans = {
		thingID: getTweetParameter('Thing ID', tweet),
		spaceID: getTweetParameter('Space ID', tweet),
		entityID: getTweetParameter('Entity ID', tweet),
		serviceType: getTweetParameter('Type', tweet),
		appCategory: getTweetParameter('AppCategory', tweet),
		description: getTweetParameter('Description', tweet),
		name: getTweetParameter('Name', tweet),
		vendor: getTweetParameter('Vendor', tweet),
		APIstring: getAPIString(tweet),
		keywords: getKeywords(tweet),
		lastSeen: Date.now(),
	};
	services.set(tweet, ans);
	//console.log(services);
}

function parseThingNetworkInfo(tweet) {
	var ans = {
		thingID: getTweetParameter('Thing ID', tweet),
		spaceID: getTweetParameter('Space ID', tweet),
		networkName: getTweetParameter('Network Name', tweet),
		commLanguage: getTweetParameter('Communication Language', tweet),
		IP: getTweetParameter('IP', tweet),
		port: getTweetParameter('Port', tweet),
		lastSeen: Date.now(),
	};
	//console.log(ans);
}

function getAPIString(tweet) {
	let param = 'API';
	let i = tweet.indexOf(param) + param.length + 5;
	let j = tweet.substring(i).indexOf('","');
	return tweet.substring(i, i + j);
}

function getKeywords(tweet) {
	let s = getTweetParameter('Keywords', tweet);
	return s.split(',');
}
