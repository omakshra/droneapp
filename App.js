import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, SafeAreaView, ScrollView, TextInput, Modal } from 'react-native';
import io from 'socket.io-client';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';

const App = () => {
    const [data, setData] = useState();
    const [serverConnected, setServerConnected] = useState(false);
    const [ipAddress, setIpAddress] = useState(''); // Store IP address
    const [showIpInput, setShowIpInput] = useState(false); // Show input for IP config
    const receivedData = useRef([]); // Store telemetry data
    const socketRef = useRef(null); // Store socket connection

    useEffect(() => {
        if (ipAddress) {
            // Initialize socket connection with the provided IP address
            socketRef.current = io(`http://${ipAddress}:3000`);
            setServerConnected(false);

            socketRef.current.on('connect', () => {
                setServerConnected(true);
            });

            socketRef.current.on('telemetryData', (data) => {
                console.log('Data from server:', data);
                setData(JSON.stringify(data));
                receivedData.current.push(data);
            });

            socketRef.current.on('disconnect', () => {
                setServerConnected(false);
            });

            const interval = setInterval(() => {
                logDataToFile();
            }, 60000);

            return () => {
                if (socketRef.current) {
                    socketRef.current.disconnect();
                }
                clearInterval(interval);
            };
        }
    }, [ipAddress]);

    const connectFunc = () => {
        if (socketRef.current) {
            socketRef.current.connect();
            setServerConnected(true);
        }
    };

    const startConnection = async () => {
        connectFunc();
        setServerConnected((nextstate) => {
            if (nextstate && socketRef.current) {
                socketRef.current.emit('start');
            } else {
                Alert.alert('Server not connected');
            }
        });
    };

    const stopConnection = () => {
        if (socketRef.current) {
            socketRef.current.disconnect();
        }
        Alert.alert('Connection stopped');
    };

    const logDataToFile = async () => {
        try {
            const logFilePath = `${RNFS.DocumentDirectoryPath}/log.txt`;

            if (receivedData.current.length === 0) {
                console.log('No data to log');
                return;
            }

            const dataToLog = receivedData.current.map(item => JSON.stringify(item)).join('\n');

            await RNFS.writeFile(logFilePath, `${dataToLog}\n`);
            receivedData.current = [];
        } catch (error) {
            Alert.alert('Error logging data');
        }
    };

    const shareLogFile = async () => {
        try {
            await logDataToFile();
            receivedData.current = [];

            const logFilePath = `${RNFS.DocumentDirectoryPath}/log.txt`;

            const fileExists = await RNFS.exists(logFilePath);
            if (!fileExists) {
                Alert.alert('Log file not found');
                return;
            }

            const shareOptions = {
                url: `file://${logFilePath}`,
                title: 'Share Log File',
                type: 'text/plain',
            };

            await Share.open(shareOptions);
        } catch (error) {
            console.error('Error sharing log file:', error);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* IP Config Button */}
            <TouchableOpacity style={styles.ipButton} onPress={() => setShowIpInput(true)}>
                <Text style={styles.buttonText}>IP Config</Text>
            </TouchableOpacity>

            {/* Modal for IP Input */}
            <Modal
                visible={showIpInput}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowIpInput(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.inputLabel}>Enter Server IP:</Text>
                        <TextInput
                            style={styles.inputField}
                            value={ipAddress}
                            onChangeText={setIpAddress}
                            placeholder="Enter IP Address"
                            keyboardType="default"
                        />
                        <TouchableOpacity
                            style={styles.button}
                            onPress={() => {
                                setShowIpInput(false);
                                if (ipAddress) {
                                    connectFunc(); // Connect with the entered IP
                                } else {
                                    Alert.alert('Please enter a valid IP address');
                                }
                            }}
                        >
                            <Text style={styles.buttonText}>Save IP</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Share Button */}
            <TouchableOpacity style={styles.shareButton} onPress={shareLogFile}>
                <Text style={styles.buttonText}>Share Log</Text>
            </TouchableOpacity>

            <Text style={styles.header}>Telemetry Data:</Text>
            <ScrollView style={styles.dataContainer}>
                <Text style={styles.data}>{data || 'Waiting for data...'}</Text>
            </ScrollView>

            <TouchableOpacity style={styles.button} onPress={startConnection}>
                <Text style={styles.buttonText}>Start</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.button} onPress={stopConnection}>
                <Text style={styles.buttonText}>Stop</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
    },
    ipButton: {
        position: 'absolute',
        top: 20,
        left: 20,
        backgroundColor: '#FF9800',
        padding: 10,
        borderRadius: 5,
        alignItems: 'center',
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 10,
        width: '80%',
        alignItems: 'center',
    },
    inputLabel: {
        fontSize: 16,
        marginBottom: 10,
    },
    inputField: {
        width: '100%',
        padding: 10,
        borderWidth: 1,
        borderColor: '#ccc',
        marginBottom: 10,
        borderRadius: 5,
    },
    shareButton: {
        position: 'absolute',
        top: 20,
        right: 20,
        backgroundColor: '#4CAF50',
        padding: 10,
        borderRadius: 5,
        alignItems: 'center',
    },
    header: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
        color: '#fff',
    },
    dataContainer: {
        maxHeight: 150,
        width: '90%',
        borderWidth: 1,
        borderColor: '#fff',
        marginBottom: 20,
        padding: 10,
    },
    data: {
        fontSize: 16,
        color: '#fff',
        textAlign: 'center',
    },
    button: {
        backgroundColor: '#4CAF50',
        padding: 15,
        marginVertical: 10,
        borderRadius: 5,
        width: '80%',
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default App;
