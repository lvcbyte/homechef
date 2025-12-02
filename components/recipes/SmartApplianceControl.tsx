// Smart Appliance Control
// Uses Web Serial API to control smart kitchen appliances

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface SmartApplianceControlProps {
  applianceType: 'oven' | 'stove' | 'microwave';
  recipeId?: string;
  onClose?: () => void;
}

interface ApplianceCommand {
  type: 'preheat' | 'cook' | 'stop';
  temperature?: number;
  durationMinutes?: number;
  mode?: string;
}

export function SmartApplianceControl({
  applianceType,
  recipeId,
  onClose,
}: SmartApplianceControlProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [port, setPort] = useState<any>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [currentCommand, setCurrentCommand] = useState<ApplianceCommand | null>(null);

  useEffect(() => {
    // Check if Web Serial API is supported
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'serial' in navigator) {
      setIsSupported(true);
    } else {
      setIsSupported(false);
    }
  }, []);

  const connectToAppliance = async () => {
    if (Platform.OS !== 'web') {
      Alert.alert('Niet Beschikbaar', 'Web Serial API is alleen beschikbaar in de browser');
      return;
    }

    try {
      // Request port access
      const serial = (navigator as any).serial;
      const selectedPort = await serial.requestPort();

      // Open port with baud rate
      await selectedPort.open({ baudRate: 9600 });

      setPort(selectedPort);
      setIsConnected(true);

      // Listen for data from appliance
      const reader = selectedPort.readable?.getReader();
      if (reader) {
        readFromPort(reader);
      }
    } catch (error: any) {
      console.error('Error connecting to appliance:', error);
      if (error.name === 'NotFoundError') {
        Alert.alert('Geen Apparaat', 'Geen compatibel apparaat gevonden');
      } else {
        Alert.alert('Fout', 'Kon niet verbinden met apparaat');
      }
    }
  };

  const readFromPort = async (reader: any) => {
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        // Handle incoming data from appliance
        const data = new TextDecoder().decode(value);
        console.log('Received from appliance:', data);
      }
    } catch (error) {
      console.error('Error reading from port:', error);
    }
  };

  const disconnect = async () => {
    if (port) {
      try {
        await port.close();
        setPort(null);
        setIsConnected(false);
        setCurrentCommand(null);
      } catch (error) {
        console.error('Error disconnecting:', error);
      }
    }
  };

  const sendCommand = async (command: ApplianceCommand) => {
    if (!port || !isConnected) {
      Alert.alert('Niet Verbonden', 'Verbind eerst met een apparaat');
      return;
    }

    try {
      const writer = port.writable?.getWriter();
      if (!writer) {
        throw new Error('Writer not available');
      }

      // Format command based on appliance type
      let commandString = '';

      switch (applianceType) {
        case 'oven':
          if (command.type === 'preheat' && command.temperature) {
            commandString = `PREHEAT:${command.temperature}\n`;
          } else if (command.type === 'cook' && command.temperature && command.durationMinutes) {
            commandString = `COOK:${command.temperature}:${command.durationMinutes}\n`;
          } else if (command.type === 'stop') {
            commandString = 'STOP\n';
          }
          break;

        case 'stove':
          if (command.type === 'cook' && command.temperature) {
            commandString = `HEAT:${command.temperature}\n`;
          } else if (command.type === 'stop') {
            commandString = 'OFF\n';
          }
          break;

        case 'microwave':
          if (command.type === 'cook' && command.durationMinutes) {
            const seconds = Math.round(command.durationMinutes * 60);
            commandString = `COOK:${seconds}\n`;
          } else if (command.type === 'stop') {
            commandString = 'STOP\n';
          }
          break;
      }

      if (commandString) {
        const encoder = new TextEncoder();
        await writer.write(encoder.encode(commandString));
        writer.releaseLock();
        setCurrentCommand(command);
        Alert.alert('Commando Verzonden', 'Apparaat ontvangt instructies');
      }
    } catch (error: any) {
      console.error('Error sending command:', error);
      Alert.alert('Fout', 'Kon commando niet verzenden');
    }
  };

  const preheatOven = async (temperature: number) => {
    await sendCommand({
      type: 'preheat',
      temperature,
    });
  };

  const startCooking = async (temperature: number, durationMinutes: number) => {
    await sendCommand({
      type: 'cook',
      temperature,
      durationMinutes,
    });
  };

  const stopAppliance = async () => {
    await sendCommand({
      type: 'stop',
    });
  };

  if (!isSupported) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Slimme Apparaten</Text>
          {onClose && (
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#0f172a" />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.notSupportedContainer}>
          <Ionicons name="warning" size={64} color="#f59e0b" />
          <Text style={styles.notSupportedTitle}>Niet Beschikbaar</Text>
          <Text style={styles.notSupportedText}>
            Web Serial API is alleen beschikbaar in ondersteunde browsers (Chrome, Edge, Opera).
            Deze functie werkt niet op mobiele apparaten.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Slimme {applianceType === 'oven' ? 'Oven' : applianceType === 'stove' ? 'Fornuis' : 'Magnetron'}</Text>
          <Text style={styles.subtitle}>Verbind met je apparaat via USB/Serial</Text>
        </View>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#0f172a" />
          </TouchableOpacity>
        )}
      </View>

      {!isConnected ? (
        <View style={styles.connectContainer}>
          <Ionicons name="hardware-chip" size={64} color="#047857" />
          <Text style={styles.connectTitle}>Apparaat Verbinden</Text>
          <Text style={styles.connectText}>
            Zorg dat je apparaat is aangesloten via USB en klaar is voor verbinding
          </Text>
          <TouchableOpacity style={styles.connectButton} onPress={connectToAppliance}>
            <Ionicons name="link" size={24} color="#fff" />
            <Text style={styles.connectButtonText}>Verbinden</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.controlContainer}>
          <View style={styles.statusCard}>
            <View style={styles.statusIndicator}>
              <Ionicons name="checkmark-circle" size={24} color="#10b981" />
              <Text style={styles.statusText}>Verbonden</Text>
            </View>
            <TouchableOpacity style={styles.disconnectButton} onPress={disconnect}>
              <Text style={styles.disconnectButtonText}>Verbinding Verbreken</Text>
            </TouchableOpacity>
          </View>

          {applianceType === 'oven' && (
            <View style={styles.commandsContainer}>
              <Text style={styles.sectionTitle}>Oven Commando's</Text>
              
              <View style={styles.commandGroup}>
                <Text style={styles.commandLabel}>Voorverwarmen</Text>
                <View style={styles.temperatureButtons}>
                  {[180, 200, 220].map((temp) => (
                    <TouchableOpacity
                      key={temp}
                      style={styles.tempButton}
                      onPress={() => preheatOven(temp)}
                    >
                      <Text style={styles.tempButtonText}>{temp}°C</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.commandGroup}>
                <Text style={styles.commandLabel}>Koken</Text>
                <View style={styles.cookInputs}>
                  <View style={styles.inputRow}>
                    <Text style={styles.inputLabel}>Temperatuur:</Text>
                    <View style={styles.temperatureButtons}>
                      {[160, 180, 200].map((temp) => (
                        <TouchableOpacity
                          key={temp}
                          style={styles.tempButton}
                          onPress={() => startCooking(temp, 30)}
                        >
                          <Text style={styles.tempButtonText}>{temp}°C</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <Text style={styles.inputHint}>30 minuten</Text>
                </View>
              </View>

              <TouchableOpacity style={styles.stopButton} onPress={stopAppliance}>
                <Ionicons name="stop" size={24} color="#fff" />
                <Text style={styles.stopButtonText}>Stop Oven</Text>
              </TouchableOpacity>
            </View>
          )}

          {currentCommand && (
            <View style={styles.activeCommandCard}>
              <Ionicons name="play-circle" size={24} color="#047857" />
              <View style={styles.activeCommandContent}>
                <Text style={styles.activeCommandTitle}>Actief Commando</Text>
                <Text style={styles.activeCommandText}>
                  {currentCommand.type === 'preheat' && `Voorverwarmen op ${currentCommand.temperature}°C`}
                  {currentCommand.type === 'cook' &&
                    `Koken op ${currentCommand.temperature}°C voor ${currentCommand.durationMinutes} min`}
                  {currentCommand.type === 'stop' && 'Stoppen'}
                </Text>
              </View>
            </View>
          )}
        </View>
      )}

      <View style={styles.infoCard}>
        <Ionicons name="information-circle" size={20} color="#64748b" />
        <Text style={styles.infoText}>
          Deze functie vereist een compatibel slim apparaat met Serial/USB ondersteuning.
          Controleer de documentatie van je apparaat voor compatibiliteit.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    paddingTop: Platform.select({ web: 20, default: 60 }),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(15,23,42,0.08)',
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notSupportedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  notSupportedTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 16,
    marginBottom: 8,
  },
  notSupportedText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  connectContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  connectTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 16,
    marginBottom: 8,
  },
  connectText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#047857',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  connectButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  controlContainer: {
    flex: 1,
    padding: 20,
    gap: 16,
  },
  statusCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
  },
  disconnectButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  disconnectButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
  },
  commandsContainer: {
    gap: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  commandGroup: {
    gap: 12,
  },
  commandLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  temperatureButtons: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  tempButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 2,
    borderColor: '#047857',
  },
  tempButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#047857',
  },
  cookInputs: {
    gap: 8,
  },
  inputRow: {
    gap: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
  },
  inputHint: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#ef4444',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  stopButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  activeCommandCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#d1fae5',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#047857',
  },
  activeCommandContent: {
    flex: 1,
  },
  activeCommandTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#065f46',
    marginBottom: 4,
  },
  activeCommandText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#047857',
  },
  infoCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#f1f5f9',
    padding: 16,
    margin: 20,
    borderRadius: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
});

