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
let ipMapping = new Map();

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
		if (value.lastSeen > Date.now() - 90000 && value.spaceID === 'Group_1')
			ans.push(value);
	}
	res.json(ans);
});

app.get('/getthings', (req, res) => {
	let ans = [];
	for (let value of thingss.values()) {
		if (value.lastSeen > Date.now() - 90000 && value.spaceID === 'Group_1')
			ans.push(value);
	}
	res.json(ans);
});

app.get('/getrelationships', (req, res) => {
	let ans = [];
	for (let value of relationships.values()) {
		if (value.lastSeen > Date.now() - 90000 && value.spaceID === 'Group_1')
			ans.push(value);
	}
	res.json(ans);
});

app.post('/setimageurl', (req, res) => {
	let imageUrl = req.body.imageUrl;
	let type = req.body.type;
	let name = req.body.name;
	let thingID = req.body.thingID;
	console.log(imageUrl);
	if (type === 'Services') {
		for (let value of services.values()) {
			if (value.name === name && value.thingID === thingID) {
				value.imageUrl = imageUrl;
				//console.log(value);
				res.json({ message: 'Url updated successfully' });
				return;
			}
		}
	} else if (type === 'Things') {
		for (let value of thingss.values()) {
			if (value.name === name && value.thingID === thingID) {
				value.imageUrl = imageUrl;
				//console.log(value);
				res.json({ message: 'Url updated successfully' });
				return;
			}
		}
	}
	res.status(400).send({ error: 'Name not found' });
});

app.post('/runservice', (req, res) => {
	//console.log(req.body.tweet.thingID);
	try {
		const Net = require('net');
		// The port number and hostname of the server.
		const port = 6668;
		let host = '0.0.0.0';
		if (ipMapping.has(req.body.tweet.thingID)) {
			host = ipMapping.get(req.body.tweet.thingID);
		} else {
			res
				.status(400)
				.send({ errorMessage: 'Could not find IP, try again after sometime' });
		}

		// Create a new TCP client.
		const client = new Net.Socket();
		// Send a connection request to the server.
		client.connect({ port: port, host: host }, function () {
			// If there is no error, the server has accepted the request and created a new
			// socket dedicated to us.
			console.log('TCP connection established with the server.');

			// The client can now send data to the server by writing to its socket.
			let numInputs = req.body.tweet.inputCount;
			let nums = req.body.tweet.inputs;
			let str = '';
			for (let i = 0; i < numInputs; i++) {
				str += nums[i].toString() + ',';
			}
			str = str.substring(0, str.length - 1);
			console.log(str);
			data = JSON.stringify({
				'Tweet Type': req.body.tweet.serviceType,
				'Thing ID': req.body.tweet.thingID,
				'Space ID': req.body.tweet.spaceID,
				'Service Name': req.body.tweet.name,
				'Service Inputs': '(' + str + ')',
			});
			console.log(data);
			client.write(data.toString());
		});

		// The client can also receive data from the server by reading from its socket.
		client.on('data', function (chunk) {
			console.log(chunk.toString());

			// // Request an end to the connection after the data has been received.
			res.json(chunk.toString());
			client.end();
		});

		client.on('end', function () {
			console.log('Requested an end to the TCP connection');
		});

		client.on('error', function (ex) {
			console.log(ex);
			res.status(400).send({ error: ex });
		});
	} catch (err) {
		console.log(err);
	}
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
		imageUrl: '',
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
		type: getTweetParameter('Type', tweet.substring(tweet.indexOf('Thing ID'))),
		description: getTweetParameter('Description', tweet),
		firstService: getTweetParameter('FS name', tweet),
		secondService: getTweetParameter('SS name', tweet),
		lastSeen: Date.now(),
		imageUrl: '',
	};
	//console.log(ans);
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
		imageUrl: '',
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
		imageUrl: '',
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
	if (ipMapping.has(ans.thingID)) {
		let temp = ipMapping.get(ans.thingID);
		temp.IP = ans.IP;
	} else {
		ipMapping.set(ans.thingID, ans.IP);
	}
	console.log(ans);
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
