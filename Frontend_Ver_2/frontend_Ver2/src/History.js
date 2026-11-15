import React, { useCallback, useState } from 'react';
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    StyleSheet,
    FlatList,
    Linking,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { HISTORY_URL, getCurrentUserId, recordHistory } from '../lib/history';

// รูปไอคอน YouTube Music ที่แสดงท้ายการ์ดเพลงแต่ละอัน
const YT_ICON_URI = 'https://static.vecteezy.com/system/resources/previews/017/395/384/non_2x/youtube-music-icon-free-png.png';

// หน้าประวัติการฟังเพลงของผู้ใช้ที่ล็อกอินอยู่
const History = ({ navigation }) => {
    const [historyList, setHistoryList] = useState([]); // รายการเพลงที่เคยฟัง (ล่าสุดอยู่บนสุด ตามที่ server เรียงมา)
    const [loading, setLoading] = useState(true);       // true ระหว่างกำลังโหลด ใช้โชว์วงกลมหมุน
    const [loggedIn, setLoggedIn] = useState(true);     // false ถ้ายังไม่ได้ล็อกอิน จะได้บอกให้ไปล็อกอินก่อน

    // โหลดประวัติใหม่ "ทุกครั้งที่เปิดหน้านี้" (useFocusEffect)
    // ต่างจาก useEffect ปกติที่ทำแค่ครั้งแรก: ถ้าผู้ใช้ไปฟังเพลงหน้าอื่นแล้วกลับมา รายการจะอัปเดตเอง
    // ขั้นตอน:
    //   1) หา id ของผู้ใช้ ถ้าไม่ได้ล็อกอินให้แสดงข้อความ "กรุณาเข้าสู่ระบบ"
    //   2) ขอประวัติของผู้ใช้คนนี้จาก server (GET /history?user_id=...)
    //   3) เอาผลมาใส่ historyList เพื่อแสดงบนจอ
    // ตัวแปร cancelled กันปัญหา: ถ้าผู้ใช้ออกจากหน้านี้ก่อนโหลดเสร็จ
    // ผลที่มาถึงทีหลังจะไม่ถูกเอาไปใส่หน้าจอที่ปิดไปแล้ว
    useFocusEffect(
        useCallback(() => {
            let cancelled = false;
            (async () => {
                setLoading(true);
                try {
                    const userId = await getCurrentUserId();
                    if (!userId) {
                        if (!cancelled) setLoggedIn(false);
                        return;
                    }
                    const res = await fetch(`${HISTORY_URL}?user_id=${userId}`);
                    const json = await res.json();
                    if (!cancelled) {
                        setLoggedIn(true);
                        setHistoryList(json.data || []);
                    }
                } catch (err) {
                    console.log('โหลด history ไม่สำเร็จ:', err);
                } finally {
                    if (!cancelled) setLoading(false);
                }
            })();
            return () => {
                cancelled = true;
            };
        }, [])
    );

    // ทำงานเมื่อกดเพลงในประวัติ
    //   1) ไม่มีลิงก์ YouTube ก็แจ้งเตือนแล้วหยุด
    //   2) ย้ายเพลงนี้ขึ้นไปบนสุดของรายการทันที (ไม่ต้องรอโหลดใหม่)
    //      โดยเอาเพลงนี้ไว้หน้าสุด แล้วตามด้วยเพลงอื่นที่ไม่ใช่เพลงนี้
    //   3) บันทึกการฟังครั้งนี้ลงประวัติใน server
    //   4) เปิดเพลงใน YouTube
    const openSong = async (item) => {
        if (!item.youtube_link) {
            Alert.alert('ไม่มีลิงก์เพลงนี้', 'เพลงนี้ยังไม่มีลิงก์ YouTube ในระบบ');
            return;
        }
        setHistoryList((prev) => [item, ...prev.filter((h) => h.song_id !== item.song_id)]);
        await recordHistory(item.song_id);
        Linking.openURL(item.youtube_link).catch((err) =>
            console.log('เปิดลิงก์ YouTube ไม่สำเร็จ:', err)
        );
    };

    const renderItem = ({ item }) => (
        <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={() => openSong(item)}>
            {item.Image_Link ? (
                <Image source={{ uri: item.Image_Link }} style={styles.songImage} />
            ) : (
                <View style={styles.songImage} />
            )}

            <View style={styles.songInfo}>
                <Text style={styles.songTitle} numberOfLines={2}>
                    {item.song_name}
                </Text>
                {item.Artist ? (
                    <Text style={styles.songArtist} numberOfLines={1}>
                        {item.Artist}
                    </Text>
                ) : null}
            </View>

            <Image source={{ uri: YT_ICON_URI }} style={styles.ytIcon} />
        </TouchableOpacity>
    );

    // ข้อความที่แสดงตอนไม่มีเพลงในรายการ แยกตามสาเหตุ (ยังไม่ล็อกอิน หรือ ยังไม่เคยฟังเพลง)
    const emptyText = !loggedIn
        ? 'กรุณาเข้าสู่ระบบเพื่อดูประวัติการฟังเพลง'
        : 'ยังไม่มีประวัติการฟังเพลง';

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

                <Text style={styles.headerTitle}>History</Text>

                <TouchableOpacity
                    style={styles.avatarButton}
                    activeOpacity={0.7}
                    onPress={() => navigation?.navigate('Profile')}
                >
                    <Feather name="user" size={24} color="#111111" />
                </TouchableOpacity>
            </View>

            {loading && historyList.length === 0 ? (
                <ActivityIndicator size="large" color="#C24A3B" style={styles.loading} />
            ) : (
                <FlatList
                    data={historyList}
                    keyExtractor={(item) => String(item.song_id)}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={<Text style={styles.emptyText}>{emptyText}</Text>}
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFF8F6',
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
    listContent: {
        paddingHorizontal: 22,
        paddingBottom: 40,
        flexGrow: 1,
    },
    loading: {
        marginTop: 60,
    },
    emptyText: {
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
        paddingVertical: 12,
        paddingHorizontal: 12,
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

export default History;
