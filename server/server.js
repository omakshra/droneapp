import { SerialPort } from 'serialport';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { MavLinkPacketSplitter, MavLinkPacketParser } from 'node-mavlink';
import mavlink from 'node-mavlink';
import express from 'express';
import fs from 'fs';
const { MavLinkPacketRegistry, minimal, common, ardupilotmega } = mavlink;
import path from 'path'; 
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = new SerialPort({
    path: 'COM3', 
    baudRate: 57600,
});

const app = express();
const server = createServer();
const io = new Server(server);
let isTransmitting = false;

const reader = port
  .pipe(new MavLinkPacketSplitter())
  .pipe(new MavLinkPacketParser());

const REGISTRY = {
    ...minimal.REGISTRY,
    ...common.REGISTRY,
    ...ardupilotmega.REGISTRY,
};

// Utility function to handle BigInt serialization
const serializeBigInt = (data) => {
    return JSON.parse(JSON.stringify(data, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value // Convert BigInt to string
    ));
};

const logData = async (data) => {
    const date = new Date();
    const dateString = date.toISOString().split('T')[0]; // Format: YYYY-MM-DD
    const logFilePath = path.join(__dirname, 'logs', `${dateString}.log`);
  
    try {
        await fs.promises.mkdir(path.join(__dirname, 'logs'), { recursive: true });
        const logEntry = `${date.toISOString()} - ${JSON.stringify(data)}\n`;
        await fs.promises.appendFile(logFilePath, logEntry);
        console.log('Data logged to file:', logFilePath);
    } catch (err) {
        console.error('Error writing to log file:', err);
    }
};

reader.on('data', (data) => {
    console.log("Raw Data Received: ", data);
    const clazz = REGISTRY[data.header.msgid];
    if (!isTransmitting) return;

    if (clazz) {
        const parsedData = data.protocol.data(data.payload, clazz);
        console.log('Parsed Packet:', parsedData);
        const serializedData = serializeBigInt(parsedData); // Serialize BigInt values
        io.emit('telemetryData', serializedData); // Emit serialized telemetry data
        logData(serializedData); // Store serialized data in the log
    }
});

port.on('error', (err) => {
    console.error('Serial port error:', err);
});

io.on('connection', (socket) => {
    console.log('Client connected');
    socket.on('start', () => {
        console.log('Received start signal from client');
        isTransmitting = true;
        logData('Data transmission started');
        console.log('Is transmitting:', isTransmitting);
    });
    
    socket.on('stop', () => {
        console.log('Received stop signal from client');
        isTransmitting = false;
        logData('Data transmission stopped');
        console.log('Is transmitting:', isTransmitting);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
        logData('Client has Disconnected');
    });
});

// Start the server
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
