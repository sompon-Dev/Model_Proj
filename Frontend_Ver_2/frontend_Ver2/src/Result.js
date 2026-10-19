import React, { useState } from 'react';
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    StyleSheet,
    FlatList,
    Linking,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';

const TRENDING_INCREMENT_URL = 'http://192.168.1.5:8000/trending_song/increment'; // ⚠️ เปลี่ยน IP เป็นของเครื่อง Server (Backend_Database/main.py) ถ้าเปลี่ยนเครื่อง

const Result = ({ navigation, route }) => {
    // State ready for future database / search query results
    const [resultsList, setResultsList] = useState(route?.params?.results || []);

    // กดการ์ดเพลง: ก่อนเด้งไป YouTube Music ให้รอนับเพลงนี้เข้า trending ให้เสร็จก่อน (ถ้ายังไม่เคย
    // นับเพลงนี้เลยก็สร้างแถวใหม่ในตาราง Trending ให้ด้วย) แล้วค่อยเปิดลิงก์ YouTube ตามหลัง — ต้อง
    // "รอ" ก่อนเปิด ไม่ใช่ยิงพร้อมกันแบบเดิม เพราะพอ Linking.openURL พาออกจากแอปไปแล้ว request ที่ยัง
    // ค้างอยู่อาจถูกตัดกลางคันไม่เสร็จ (แอปถูกส่งไปพักหลังฉาก)
    const openYoutube = async (item) => {
        if (!item.youtube_link) {
            Alert.alert('ไม่มีลิงก์เพลงนี้', 'เพลงนี้ยังไม่มีลิงก์ YouTube ในระบบ');
            return;
        }

        // item.id มีค่าก็ต่อเมื่อรู้ song_id จริงจาก database เท่านั้น (ดู Homeuser.js) ถ้าไม่รู้ก็ข้ามนับ
        if (item.id) {
            try {
                await fetch(`${TRENDING_INCREMENT_URL}?song_id=${item.id}`, { method: 'POST' });
            } catch (err) {
                console.log('นับเพลงเข้า trending ไม่สำเร็จ:', err);
                // นับไม่สำเร็จก็ยังเปิด YouTube ต่อได้ตามปกติ ไม่ให้ปัญหาการนับมาบล็อกการฟังเพลง
            }
        }

        Linking.openURL(item.youtube_link).catch((err) =>
            console.log('เปิดลิงก์ YouTube ไม่สำเร็จ:', err)
        );
    };

    // การ์ดเพลง 1 ใบ (แยกออกมาให้ FlatList เรียกใช้ทีละใบ — FlatList จะ render แค่การ์ดที่
    // อยู่บนจอจริงๆ เท่านั้น ไม่ใช่ทุกใบพร้อมกันทีเดียวแบบ ScrollView+map เดิม ผลลัพธ์เยอะแค่ไหนก็ไม่ค้าง)
    const renderSongCard = ({ item }) => (
        <TouchableOpacity
            style={styles.card}
            activeOpacity={0.8}
            onPress={() => openYoutube(item)}
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
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />

            {/* Header (Back button on top left, Avatar on top right) */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    activeOpacity={0.7}
                    onPress={() => navigation?.goBack()}
                >
                    <Feather name="arrow-left" size={24} color="#111111" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.avatarButton}
                    activeOpacity={0.7}
                    onPress={() => navigation?.navigate('Login')}
                >
                    <Feather name="user" size={24} color="#111111" />
                </TouchableOpacity>
            </View>

            {/* Results List */}
            <FlatList
                data={resultsList}
                keyExtractor={(item, index) => String(item.id ?? index)}
                renderItem={renderSongCard}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <Text style={styles.notFoundText}>ไม่พบเพลงที่ตรงกับตัวเลือกนี้</Text>
                }
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFF8F6',
    },
    listContent: {
        paddingHorizontal: 22,
        paddingBottom: 40,
        flexGrow: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 22,
        paddingTop: 12,
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
    notFoundText: {
        fontSize: 15,
        color: '#888888',
        textAlign: 'center',
        marginTop: 60,
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

export default Result;
