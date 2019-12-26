// Copyright 1998-2019 Epic Games, Inc. All Rights Reserved.

const argv = require('yargs').argv;

let httpPort = 80;
let matchmakerPort = 9999;
const publicIp = argv.publicIp;
const localIp = argv.localIp;
const local = argv.local;

const express = require('express');
const app = express();
const http = require('http').Server(app);
const { exec } = require('child_process');

// startsAt
const Signalling = {
	httpPort: 1025,
	streamerPort: 8881,
	loading: false,
	connections: []
}

// events
const EventEmitter = require('events');
const Events = {
	emmiter: new EventEmitter,
	onCirrusConnected: 'onCirrusConnected',
	onCirrusDisonnected: 'onCirrusDisonnected',
	onClientConnected: 'onClientConnected',
	onClientDisonnected: 'onClientDisonnected'
};

Events.emmiter.on(Events.onCirrusConnected, httpPort => {
	setLoadedSignallingConnection(httpPort);
	console.log(Signalling);
});

Events.emmiter.on(Events.onCirrusDisonnected, httpPort => {
	console.info('onCirrusDisonnected', {httpPort});
	// updating Signalling state
	const i = getSignallingConnectionIndex(httpPort);
	const connection = Signalling.connections[i];

	Signalling.connections.splice(i, 1);

	if (Signalling.connections.length === 0) {
		resetSignallingPorts();
	// check if it was the last connection to dicrement it
	} else if (connection) {
		if (connection.httpPort === Signalling.httpPort-1 && connection.streamerPort === Signalling.streamerPort-1) {
			decrementSignallingPorts();
		}
	} else {
		console.log('onCirrusDisonnected: no connection');
	}

	console.log('connections', Signalling.connections.length);
	console.log(Signalling);
});

Events.emmiter.on(Events.onClientConnected, httpPort => {
	const connection = getSignallingConnection(httpPort);
	
	if (connection) {
		connection.clientConnected = true;
		console.log('clientConnected', connection.clientConnected);
	} else {
		console.log('onClientConnected: no connection');
	}

	console.log(Signalling);
	// 
});

Events.emmiter.on(Events.onClientDisonnected, httpPort => {
	let i = getSignallingConnectionIndex(httpPort);
	let connection = Signalling.connections[i];

	if (connection) {
		connection.clientConnected = false;
		console.log('clientConnected', connection.clientConnected);

		setTimeout(() => {
			i = getSignallingConnectionIndex(httpPort);
			connection = Signalling.connections[i];
			console.log('inTimeout', {i, connection, httpPort})

			if (!connection.clientConnected) {
				removeSignallingConnection(connection.httpPort, connection.streamerPort);
			}
		}, 30 * 1000);
	} else {
		console.log('onClientDisonnected: no connection');
	}

	console.log(Signalling);
});

// functions
function getSignallingConnectionIndex(httpPort, streamerPort) {
	let i = null;

	if (httpPort) {
		i = Signalling.connections.map(connection => connection.httpPort).indexOf(httpPort);
	} else if (streamerPort) {
		i = Signalling.connections.map(connection => connection.streamerPort).indexOf(streamerPort);
	} else {
		console.error('getSignallingConnectionIndex: please provide httpPort or streamerPort');
	}

	return i
}

function getSignallingConnection(httpPort, streamerPort) {
	const i = getSignallingConnectionIndex(httpPort, streamerPort);
	let connection = null;

	if (i !== null) {
		connection = Signalling.connections[i];
	}

	return connection
}

function addSignallingConnection(httpPort, streamerPort) {
	Signalling.loading = true;
	Signalling.connections.push({
		httpPort,
		streamerPort,
		loading: true
	})
}

function incrementSignallingPorts() {
	Signalling.httpPort++;
	Signalling.streamerPort++;
}

function decrementSignallingPorts() {
	Signalling.httpPort--;
	Signalling.streamerPort--;
}

function resetSignallingPorts() {
	Signalling.httpPort = 1025;
	Signalling.streamerPort = 8881;
}

function killPort(port, cb) {
	exec('netstat -ano | findstr :'+port, (error, stdout, stderr) => {
        const lines = stdout.split('\n')
        const ports = lines.reduce((acc, line) => {
			// check if it is localhost
			// if (line.match('0.0.0.0:'+port)) {
				// getting a processes id
				const match = line.match(/(\d*)\w*(\n|$)/gm);
				return match && match[0] && !acc.includes(match[0]) ? acc.concat(match[0]) : acc;
			// } else {
				// return acc
			// }
		}, [])
		
		// console.log(stdout);
		// console.log(ports);

        return exec(`taskkill /PID ${ports.join(' /PID ')} /F`, (error, stdout, stderr) => {
			// if (error) {
			// 	console.error(`exec error: ${error}`);
			// 	return;
			// }
			// console.log(`stdout: ${stdout}`);
			// console.error(`stderr: ${stderr}`);

			if (cb) {
				cb();
			}
		});
	});
}

function removeSignallingConnection(httpPort, streamerPort) {
	console.info('removeSignallingConnection', {httpPort, streamerPort});
	killPort(streamerPort);
	killPort(httpPort);
}

function setLoadedSignallingConnection(httpPort, streamerPort) {
	const i = getSignallingConnectionIndex(httpPort, streamerPort);

	if (i !== null) {
		Signalling.connections[i].loading = false;
	}

	Signalling.loading = false;
}

function startNewCirrusServer(req, res) {
	exec('start "" "..\\..\\..\\..\\..\\..\\RealisticRendering.exe" -AudioMixer -RenderOffScreen -PixelStreamingIP=localhost -PixelStreamingPort='+ Signalling.streamerPort);
	exec('start "" "..\\SignallingWebServer\\runWithParams.bat" '+ Signalling.httpPort +' '+ Signalling.streamerPort);

	res.redirect(`http://${publicIp}:${Signalling.httpPort}/`);

	addSignallingConnection(Signalling.httpPort, Signalling.streamerPort);
	incrementSignallingPorts();
}
// 

// A list of all the Cirrus server which are connected to the Matchmaker.
var cirrusServers = new Map();

//
// Parse command line.
//

if (typeof argv.httpPort != 'undefined') {
	httpPort = argv.httpPort;
}
if (typeof argv.matchmakerPort != 'undefined') {
	matchmakerPort = argv.matchmakerPort;
}

//
// Connect to browser.
//

http.listen(httpPort, () => {
    console.log('HTTP listening on *:' + httpPort);
});

// Get a Cirrus server if there is one available which has no clients connected.
function getAvailableCirrusServer() {
	for (cirrusServer of cirrusServers.values()) {
		if (cirrusServer.numConnectedClients === 0) {
			return cirrusServer;
		}
	}

	console.log('WARNING: No empty Cirrus servers are available');
	return undefined;
}

// No servers are available so send some simple JavaScript to the client to make
// it retry after a short period of time.
function sendRetryResponse(res) {
	res.send(`All ${cirrusServers.size} Cirrus servers are in use. Retrying in <span id="countdown">10</span> seconds.
	<script>
		var countdown = document.getElementById("countdown").textContent;
		setInterval(function() {
			countdown--;
			if (countdown == 0) {
				window.location.reload(1);
			} else {
				document.getElementById("countdown").textContent = countdown;
			}
		}, 1000);
	</script>`);
}

// Handle standard URL.
app.get('/', (req, res) => {
	if (!Signalling.loading) {
		cirrusServer = getAvailableCirrusServer();
		if (cirrusServer != undefined) {
			let link;

			if (local) {
				link = `http://${localIp}:${cirrusServer.port}/`;
			} else {
				link = `http://${cirrusServer.address}:${cirrusServer.port}/`;
			};

			res.redirect(link);

			// restriction for the next users
			cirrusServer.numConnectedClients++
			console.log(`Redirect to ${link}`);
		} else {
			startNewCirrusServer(req, res);
			// sendRetryResponse(res);
		}
	}
});

// Handle URL with custom HTML.
// app.get('/custom_html/:htmlFilename', (req, res) => {
// 	if (!Signalling.loading) {
// 		cirrusServer = getAvailableCirrusServer();
// 		if (cirrusServer != undefined) {
// 			let link;

// 			if (local) {
// 				link = `http://${localIp}:${cirrusServer.port}/custom_html/${req.params.htmlFilename}/`;
// 			} else {
// 				link = `http://${cirrusServer.address}:${cirrusServer.port}/custom_html/${req.params.htmlFilename}/`;
// 			};

// 			res.redirect(link);

// 			// restriction for the next users
// 			cirrusServer.numConnectedClients++
// 			console.log(`Redirect to ${link}`);
// 		} else {
// 			startNewCirrusServer(req, res);
// 			// sendRetryResponse(res);
// 		}
// 	}
// });

//
// Connection to Cirrus.
//

const net = require('net');

function disconnect(connection) {
	console.log(`Ending connection to remote address ${connection.remoteAddress}`);
	connection.end();
}

const matchmaker = net.createServer((connection) => {
	connection.on('data', (data) => {
		try {
			message = JSON.parse(data);
		} catch(e) {
			console.log(`ERROR (${e.toString()}): Failed to parse Cirrus information from data: ${data.toString()}`);
			disconnect(connection);
			return;
		}
		if (message.type === 'connect') {
			// A Cirrus server connects to this Matchmaker server.
			cirrusServer = {
				address: message.address,
				port: message.port,
				numConnectedClients: 0
			};
			cirrusServers.set(connection, cirrusServer);

			Events.emmiter.emit(Events.onCirrusConnected, cirrusServer.port);
			console.log(`Cirrus server ${cirrusServer.address}:${cirrusServer.port} connected to Matchmaker`);
		} else if (message.type === 'clientConnected') {
			// A client connects to a Cirrus server.
			cirrusServer = cirrusServers.get(connection);
			cirrusServer.numConnectedClients++;

			Events.emmiter.emit(Events.onClientConnected, cirrusServer.port);
			console.log(`Client connected to Cirrus server ${cirrusServer.address}:${cirrusServer.port}`);
		} else if (message.type === 'clientDisconnected') {
			// A client disconnects from a Cirrus server.
			cirrusServer = cirrusServers.get(connection);
			cirrusServer.numConnectedClients--;

			Events.emmiter.emit(Events.onClientDisonnected, cirrusServer.port);
			console.log(`Client disconnected from Cirrus server ${cirrusServer.address}:${cirrusServer.port}`);
		} else {
			console.log('ERROR: Unknown data: ' + JSON.stringify(message));
			disconnect(connection);
		}
	});

	// A Cirrus server disconnects from this Matchmaker server.
	connection.on('error', () => {
		cirrusServer = cirrusServers.get(connection);
		console.log(`Cirrus server ${cirrusServer.address}:${cirrusServer.port} disconnected from Matchmaker`);
		Events.emmiter.emit(Events.onCirrusDisonnected, cirrusServer.port);
		cirrusServers.delete(connection);
	});
});

matchmaker.listen(matchmakerPort, () => {
	console.log('Matchmaker listening on *:' + matchmakerPort);
});
