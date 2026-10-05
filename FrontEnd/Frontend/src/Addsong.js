import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather, Ionicons } from '@expo/vector-icons';

const Addsong = ({ navigation }) => {
    const [songName, setSongName] = useState('');
    const [artist, setArtist] = useState('');
    const [lyrics, setLyrics] = useState('');
    const [genre, setGenre] = useState('');
    const [mood, setMood] = useState('');

    const handleEnter = () => {
        // Logic สำหรับการบันทึกเพลง
        console.log({ songName, artist, lyrics, genre, mood });
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />
            <ScrollView contentContainerStyle={styles.scrollContent}>
                
                {/* Header Profile Icon */}
                <View style={styles.header}>
                    <TouchableOpacity 
                        style={styles.profileButton}
                        onPress={() => navigation?.navigate('Profile')}
                    >
                        <Feather name="user" size={24} color="#000000" />
                    </TouchableOpacity>
                </View>

                {/* Title */}
                <Text style={styles.title}>Add Song</Text>

                {/* Main Card Container */}
                <View style={styles.card}>
                    {/* Song name Input */}
                    <View style={styles.inputBox}>
                        <TextInput
                            style={styles.input}
                            placeholder="Song name"
                            placeholderTextColor="#000000"
                            value={songName}
                            onChangeText={setSongName}
                        />
                    </View>

                    {/* Artist Input */}
                    <View style={styles.inputBox}>
                        <TextInput
                            style={styles.input}
                            placeholder="Artist"
                            placeholderTextColor="#000000"
                            value={artist}
                            onChangeText={setArtist}
                        />
                    </View>

                    {/* Lyrics Input */}
                    <View style={styles.inputBox}>
                        <TextInput
                            style={styles.input}
                            placeholder="Lyrics"
                            placeholderTextColor="#000000"
                            value={lyrics}
                            onChangeText={setLyrics}
                            multiline
                        />
                    </View>

                    {/* GENRE Row */}
                    <View style={styles.dropdownRow}>
                        <Text style={styles.label}>GENRE</Text>
                        <View style={styles.dropdownBox}>
                            <Ionicons name="filter-outline" size={18} color="#000000" style={styles.filterIcon} />
                            <TextInput
                                style={styles.dropdownInput}
                                value={genre}
                                onChangeText={setGenre}
                            />
                        </View>
                    </View>

                    {/* MOOD Row */}
                    <View style={styles.dropdownRow}>
                        <Text style={styles.label}>MOOD</Text>
                        <View style={styles.dropdownBox}>
                            <Ionicons name="filter-outline" size={18} color="#000000" style={styles.filterIcon} />
                            <TextInput
                                style={styles.dropdownInput}
                                value={mood}
                                onChangeText={setMood}
                            />
                        </View>
                    </View>
                </View>

                {/* Enter Button */}
                <TouchableOpacity 
                    style={styles.enterButton}
                    activeOpacity={0.8}
                    onPress={handleEnter}
                >
                    <Text style={styles.enterButtonText}>Enter</Text>
                </TouchableOpacity>

            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFC47E', // สีส้มพาสเทล
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingBottom: 40,
        alignItems: 'center',
    },
    header: {
        width: '100%',
        alignItems: 'flex-end',
        marginTop: 10,
    },
    profileButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 48,
        fontWeight: 'bold',
        color: '#000000',
        textAlign: 'center',
        marginTop: 10,
        marginBottom: 20,
    },
    card: {
        width: '100%',
        maxWidth: 450,
        borderWidth: 1.5,
        borderColor: '#000000',
        borderRadius: 40,
        padding: 24,
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
    inputBox: {
        width: '100%',
        height: 48,
        borderWidth: 1.5,
        borderColor: '#000000',
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        paddingHorizontal: 16,
    },
    input: {
        width: '100%',
        textAlign: 'center',
        fontSize: 16,
        fontWeight: 'bold',
        color: '#000000',
    },
    dropdownRow: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        marginTop: 10,
    },
    label: {
        width: 70,
        fontSize: 14,
        fontWeight: 'bold',
        color: '#000000',
    },
    dropdownBox: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        height: 32,
        paddingHorizontal: 8,
    },
    filterIcon: {
        marginRight: 6,
    },
    dropdownInput: {
        flex: 1,
        fontSize: 14,
        color: '#000000',
        padding: 0,
    },
    enterButton: {
        marginTop: 20,
        width: 160,
        height: 44,
        borderWidth: 1.5,
        borderColor: '#000000',
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    enterButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#000000',
    },
});

export default Addsong;