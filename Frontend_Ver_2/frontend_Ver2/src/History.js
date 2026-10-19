import React, { useState } from 'react';
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';

const History = ({ navigation }) => {
    // State ready for future database connection
    const [historyList, setHistoryList] = useState([]);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        activeOpacity={0.7}
                        onPress={() => navigation?.goBack()}
                    >
                        <Feather name="arrow-left" size={24} color="#111111" />
                    </TouchableOpacity>

                    <Text style={styles.headerTitle}>History</Text>

                    <TouchableOpacity
                        style={styles.avatarButton}
                        activeOpacity={0.7}
                        onPress={() => navigation?.navigate('Login')}
                    >
                        <Feather name="user" size={24} color="#111111" />
                    </TouchableOpacity>
                </View>

                {/* History List */}
                <View style={styles.listContainer}>
                    {historyList.length > 0 ? (
                        historyList.map((item, index) => (
                            <TouchableOpacity
                                key={item.id || index}
                                style={styles.card}
                                activeOpacity={0.8}
                            >
                                <View style={styles.songInfo}>
                                    <Text style={styles.songTitle} numberOfLines={2}>
                                        {item.title}
                                    </Text>
                                    {item.artist ? (
                                        <Text style={styles.songArtist} numberOfLines={1}>
                                            {item.artist}
                                        </Text>
                                    ) : null}
                                </View>

                                <Image
                                    source={{ uri: 'https://static.vecteezy.com/system/resources/previews/017/395/384/non_2x/youtube-music-icon-free-png.png' }}
                                    style={styles.ytIcon}
                                />
                            </TouchableOpacity>
                        ))
                    ) : (
                        <>
                            {[1, 2, 3].map((placeholderId) => (
                                <TouchableOpacity
                                    key={placeholderId}
                                    style={styles.card}
                                    activeOpacity={0.8}
                                >
                                    <View style={styles.songInfo}>
                                        <Text style={styles.songTitle} numberOfLines={1}>
                                            Song Title
                                        </Text>
                                        <Text style={styles.songArtist} numberOfLines={1}>
                                            Artist Name
                                        </Text>
                                    </View>

                                    <Image
                                        source={{ uri: 'https://static.vecteezy.com/system/resources/previews/017/395/384/non_2x/youtube-music-icon-free-png.png' }}
                                        style={styles.ytIcon}
                                    />
                                </TouchableOpacity>
                            ))}
                        </>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFF8F6',
    },
    scrollContent: {
        paddingHorizontal: 22,
        paddingTop: 12,
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#F0C0B6',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111111',
    },
    avatarButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#F0C0B6',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    listContainer: {
        width: '100%',
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#F6D5CE',
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
    },
    songInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    songTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#111111',
        lineHeight: 18,
    },
    songArtist: {
        fontSize: 13,
        fontWeight: '500',
        color: '#777777',
        marginTop: 2,
    },
    ytIcon: {
        width: 36,
        height: 36,
        marginLeft: 10,
        resizeMode: 'contain',
    },
});

export default History;
