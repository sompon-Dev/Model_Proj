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
import { recordHistory } from '../lib/history';

// API บน Render สำหรับ +1 ยอดฟังของเพลง (ใช้ทำสถิติเพลงยอดนิยมในหน้า MostSearch ของแอดมิน)
const TRENDING_INCREMENT_URL = 'https://lyriseek-api-database.onrender.com/trending_song/increment';

// หน้าผลการค้นหา: แสดงรายการเพลงที่ค้นเจอ ให้ผู้ใช้กดเลือกไปฟังบน YouTube
// ข้อมูลเพลงไม่ได้โหลดในหน้านี้เอง แต่หน้า Homeuser ค้นหาเสร็จแล้วส่งมาให้ทาง route.params.results
const Result = ({ navigation, route }) => {
    // resultsList = รายการเพลงที่จะแสดง ถ้าไม่มีผลส่งมาให้เป็นรายการว่าง (กันแอปพัง)
    // แต่ละเพลงมีหน้าตาประมาณ { id, title, artist, image_link, youtube_link }
    const [resultsList, setResultsList] = useState(route?.params?.results || []);

    // ทำงานเมื่อผู้ใช้กดเพลงในรายการ
    // ขั้นตอน:
    //   1) ถ้าเพลงนี้ไม่มีลิงก์ YouTube ให้เด้งแจ้งเตือน แล้วหยุด
    //   2) ถ้าเพลงมี id (คือมีอยู่ใน database) ให้ทำ 2 อย่างพร้อมกัน
    //        - +1 ยอดฟังในตาราง trending_song
    //        - บันทึกลงประวัติการฟังของผู้ใช้ (ตาราง history)
    //      Promise.all = รอให้ทั้งสองอย่างเสร็จก่อน จะได้ไม่หลุดตอนแอปสลับไป YouTube
    //   3) เปิดลิงก์เพลงในแอป YouTube Music (หรือเบราว์เซอร์ถ้าไม่มีแอป)
    // ถ้าข้อ 2 พลาด จะแค่เขียน log ไว้ ผู้ใช้ยังได้ฟังเพลงตามปกติ
    const openYoutube = async (item) => {
        if (!item.youtube_link) {
            Alert.alert('ไม่มีลิงก์เพลงนี้', 'เพลงนี้ยังไม่มีลิงก์ YouTube ในระบบ');
            return;
        }

        if (item.id) {
            const countTrending = fetch(`${TRENDING_INCREMENT_URL}?song_id=${item.id}`, { method: 'POST' })
                .catch((err) => console.log('นับเพลงเข้า trending ไม่สำเร็จ:', err));
            await Promise.all([countTrending, recordHistory(item.id)]);
        }

        Linking.openURL(item.youtube_link).catch((err) =>
            console.log('เปิดลิงก์ YouTube ไม่สำเร็จ:', err)
        );
    };

    // บอก FlatList ว่าเพลงแต่ละเพลงต้องวาดเป็นการ์ดหน้าตาแบบไหน กดการ์ดแล้วเรียก openYoutube
    const renderSongCard = ({ item }) => (
        <TouchableOpacity
            style={styles.card}
            activeOpacity={0.8}
            onPress={() => openYoutube(item)}
        >
            {item.image_link ? (
                <Image source={{ uri: item.image_link }} style={styles.songImage} />
            ) : (
                <View style={styles.songImage} />
            )}

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
                    onPress={() => navigation?.navigate('Profile')}
                >
                    <Feather name="user" size={24} color="#111111" />
                </TouchableOpacity>
            </View>

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
    songImage: {
        width: 64,
        height: 48,
        borderRadius: 8,
        backgroundColor: '#E2E8F0',
        marginRight: 12,
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
