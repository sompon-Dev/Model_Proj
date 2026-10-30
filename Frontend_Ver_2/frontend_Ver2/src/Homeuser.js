import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    Image,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    Alert,
    Platform,
    Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import {
    useAudioRecorder,
    requestRecordingPermissionsAsync,
    setAudioModeAsync,
    RecordingPresets,
    IOSOutputFormat,
    AudioQuality,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { recordHistory } from '../lib/history';

// ตั้งค่าการอัดเสียงให้รองรับ Google Speech-to-Text (คัดลอกมาจากฟีเจอร์ไมค์ของเพื่อน)
const RECORDING_OPTIONS =
    Platform.OS === 'ios'
        ? {
            ...RecordingPresets.HIGH_QUALITY,
            extension: '.wav',
            sampleRate: 16000,
            numberOfChannels: 1,
            ios: {
                outputFormat: IOSOutputFormat.LINEARPCM,
                audioQuality: AudioQuality.HIGH,
                linearPCMBitDepth: 16,
                linearPCMIsBigEndian: false,
                linearPCMIsFloat: false,
            },
        }
        : {
            ...RecordingPresets.HIGH_QUALITY,
            extension: '.amr',
            sampleRate: 16000,
            numberOfChannels: 1,
            bitRate: 23850,
            android: {
                outputFormat: 'amrwb',
                audioEncoder: 'amr_wb',
            },
        };

const GOOGLE_AUDIO_CONFIG =
    Platform.OS === 'ios'
        ? { encoding: 'LINEAR16', sampleRateHertz: 16000 }
        : { encoding: 'AMR_WB', sampleRateHertz: 16000 };

const GENRE_URL = 'https://lyriseek-api-database.onrender.com/Genre'; // ⚠️ เปลี่ยน IP เป็นของเครื่อง Server (Backend_Database/main.py) ถ้าเปลี่ยนเครื่อง (ส่งกลับมาเป็น genre_id + genre_name)
const MOOD_URL = 'https://lyriseek-api-database.onrender.com/Mood'; // ⚠️ IP เดียวกับ GENRE_URL (ส่งกลับมาเป็น mood_id + mood_name)
const SONG_BY_GENRE_URL = 'https://lyriseek-api-database.onrender.com/Song/by_genre'; // ⚠️ IP เดียวกับ GENRE_URL (Backend_Database/main.py พอร์ต 8000)
const SEARCH_URL = 'https://sompon-dev--lyriseek-search-web.us-east.modal.run/search'; // Ver.5/API.py deploy อยู่บน Modal (ดู Ver.5/modal_app.py)
const SONG_BY_NAMES_URL = 'https://lyriseek-api-database.onrender.com/Song/by_names'; // ⚠️ IP เดียวกับ GENRE_URL
const RECOMMENDED_URL = 'https://lyriseek-api-database.onrender.com/trending_song/recommended'; // ⚠️ IP เดียวกับ GENRE_URL (เพลงที่แอดมินกด Add ไว้ใน MostSearch.js)
const TRENDING_INCREMENT_URL = 'https://lyriseek-api-database.onrender.com/trending_song/increment'; // ⚠️ IP เดียวกับ GENRE_URL

const Homeuser = ({ navigation }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [genreList, setGenreList] = useState([]); // [{ genre_id, genre_name }, ...]
    const [genreSearch, setGenreSearch] = useState('');
    const [selectedGenres, setSelectedGenres] = useState([]); // เก็บ genre_id ที่ถูกติ๊กไว้ (เหมือน checkbox)
    const [moodList, setMoodList] = useState([]); // [{ mood_id, mood_name }, ...]
    const [moodSearch, setMoodSearch] = useState('');
    const [selectedMoods, setSelectedMoods] = useState([]); // เก็บ mood_id ที่ถูกติ๊กไว้ (เหมือน checkbox)
    const [loadingSongs, setLoadingSongs] = useState(false); // true ระหว่างกำลังดึงเพลงตาม genre ที่เลือก (โชว์หน้า loading)
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);

    const [forYouList, setForYouList] = useState([]); // เพลงที่แอดมินตั้งเป็นเพลงแนะนำไว้ (trend_add = true)

    const recorder = useAudioRecorder(RECORDING_OPTIONS);

    // โหลดเพลงแนะนำ ("For You") ตอนเปิดหน้านี้
    useEffect(() => {
        fetch(RECOMMENDED_URL)
            .then((res) => res.json())
            .then((json) => setForYouList(json.data || []))
            .catch((err) => console.log('โหลดเพลงแนะนำไม่สำเร็จ:', err));
    }, []);

    // กดการ์ดเพลงใน For You: นับเข้า trending ก่อนแล้วค่อยเปิด YouTube Music (เหมือน openYoutube ใน Result.js)
    // ต้องรอให้นับเสร็จก่อนเปิดลิงก์ เพราะพอ Linking.openURL พาออกจากแอปแล้ว request ที่ค้างอยู่อาจถูกตัดกลางคัน
    const openRecommendedSong = async (song) => {
        if (!song.youtube_link) {
            Alert.alert('ไม่มีลิงก์เพลงนี้', 'เพลงนี้ยังไม่มีลิงก์ YouTube ในระบบ');
            return;
        }
        const countTrending = fetch(`${TRENDING_INCREMENT_URL}?song_id=${song.song_id}`, { method: 'POST' })
            .catch((err) => console.log('นับเพลงเข้า trending ไม่สำเร็จ:', err));
        await Promise.all([countTrending, recordHistory(song.song_id)]);
        Linking.openURL(song.youtube_link).catch((err) =>
            console.log('เปิดลิงก์ YouTube ไม่สำเร็จ:', err)
        );
    };

    // เริ่มอัดเสียง (กดไมค์ครั้งแรก) — ของเพื่อน คัดลอกมาทั้งหมด
    const startRecording = async () => {
        try {
            const permission = await requestRecordingPermissionsAsync();
            if (!permission.granted) {
                Alert.alert('คำเตือน', 'กรุณาอนุญาตการใช้งานไมโครโฟน');
                return;
            }
            await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
            await recorder.prepareToRecordAsync();
            recorder.record();
            setIsRecording(true);
        } catch (err) {
            console.error('Failed to start recording:', err);
            Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถเปิดไมโครโฟนได้');
        }
    };

    // หยุดอัดเสียง (กดไมค์ครั้งที่สอง) แล้วส่งไฟล์เสียงไปแปลงเป็นข้อความผ่าน Google Speech-to-Text
    // ได้คำมาแล้วใส่ลงช่อง search ตรงๆ (ใช้ searchQuery เดียวกับที่พิมพ์เอง ไม่ต้องมี state แยก)
    const stopRecording = async () => {
        setIsRecording(false);
        setIsTranscribing(true);
        try {
            await recorder.stop();
            await setAudioModeAsync({ allowsRecording: false });
            const uri = recorder.uri;
            if (!uri) throw new Error('ไม่พบไฟล์เสียง');

            const base64Audio = await FileSystem.readAsStringAsync(uri, {
                encoding: FileSystem.EncodingType.Base64,
            });

            const apiKey = process.env.EXPO_PUBLIC_GOOGLE_SPEECH_API_KEY;
            if (!apiKey) {
                Alert.alert('ข้อผิดพลาด', 'ไม่พบ API key (ลอง npx expo start -c)');
                return;
            }

            const response = await fetch(
                `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        config: { ...GOOGLE_AUDIO_CONFIG, languageCode: 'th-TH' },
                        audio: { content: base64Audio },
                    }),
                }
            );

            const data = await response.json();
            console.log('STT response:', JSON.stringify(data));

            if (data.error) {
                Alert.alert('Google API Error', data.error.message);
            } else if (data.results?.length > 0) {
                const transcript = data.results[0].alternatives?.[0]?.transcript?.trim() || '';
                setSearchQuery(transcript);
            } else {
                Alert.alert('แจ้งเตือน', 'ไม่พบเสียงพูด หรือไม่สามารถแปลงเสียงได้');
            }
        } catch (error) {
            console.error('Speech to text error:', error);
            Alert.alert('ข้อผิดพลาด', String(error?.message || error));
        } finally {
            setIsTranscribing(false);
        }
    };

    // กดปุ่มไมค์: ยังไม่ได้อัด -> เริ่มอัด, กำลังอัดอยู่ -> หยุดอัดแล้วแปลงเสียงเป็นข้อความ
    const handleMicPress = () => {
        if (isTranscribing) return;
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    // กดปุ่ม Filter แล้วเปิด/ปิด panel เหมือนเดิม + ดึง list genre และ mood ทั้งหมดจาก server มาโชว์
    const handleFilterPress = () => {
        setShowFilters(!showFilters);
        fetch(GENRE_URL)
            .then((res) => res.json())
            .then((json) => setGenreList(json.data))
            .catch((err) => console.log('โหลด genre ไม่สำเร็จ:', err));
        fetch(MOOD_URL)
            .then((res) => res.json())
            .then((json) => setMoodList(json.data))
            .catch((err) => console.log('โหลด mood ไม่สำเร็จ:', err));
    };

    // กดปุ่ม genre แต่ละอัน (เหมือน checkbox): ติ๊ก/ถอนติ๊ก แล้ว log รายชื่อ + genre_id ที่เลือกออก terminal
    const toggleGenre = (genre) => {
        const isChecked = selectedGenres.includes(genre.genre_id);
        const updatedSelectedGenres = isChecked
            ? selectedGenres.filter((id) => id !== genre.genre_id)
            : [...selectedGenres, genre.genre_id];

        setSelectedGenres(updatedSelectedGenres);

        const selectedGenreDetails = genreList.filter((g) =>
            updatedSelectedGenres.includes(g.genre_id)
        );

        console.log('selectedGenres (genre_id ที่ติ๊กไว้):', updatedSelectedGenres);
        console.log(
            'เลือก genre:',
            selectedGenreDetails
                .map((g) => `${g.genre_name} (genre_id: ${g.genre_id})`)
                .join(', ')
        );
    };

    // กดปุ่ม mood แต่ละอัน (เหมือน checkbox): หลักการเดียวกับ toggleGenre เป๊ะๆ
    const toggleMood = (mood) => {
        const isChecked = selectedMoods.includes(mood.mood_id);
        const updatedSelectedMoods = isChecked
            ? selectedMoods.filter((id) => id !== mood.mood_id)
            : [...selectedMoods, mood.mood_id];

        setSelectedMoods(updatedSelectedMoods);

        const selectedMoodDetails = moodList.filter((m) =>
            updatedSelectedMoods.includes(m.mood_id)
        );

        console.log('selectedMoods (mood_id ที่ติ๊กไว้):', updatedSelectedMoods);
        console.log(
            'เลือก mood:',
            selectedMoodDetails
                .map((m) => `${m.mood_name} (mood_id: ${m.mood_id})`)
                .join(', ')
        );
    };

    // กดปุ่ม apply: ดึงเพลงตาม genre ที่ติ๊กไว้จาก server ก่อน (โชว์ loading ไว้ระหว่างรอ)
    // แล้วค่อยไปหน้า Result พร้อมส่งรายชื่อเพลงที่ได้ไปด้วย (ถ้าไม่มีเพลงเลยก็ส่ง list ว่างไป
    // ให้หน้า Result.js เป็นคนแสดงว่า "ไม่พบ")
    const handleApplyPress = async () => {
        setLoadingSongs(true);

        // ตั้งเวลารอ server สูงสุด 30 วินาที ถ้า server ไม่ตอบเลยก็ยกเลิก request ทิ้ง
        // (ไม่งั้นถ้า server เงียบไปเฉยๆ เช่น IP ผิด/server ไม่ได้รัน หน้า loading จะค้างตลอดไป)
        // เดิมตั้งไว้ 10 วิ แต่ backend อยู่บน Render free tier ซึ่ง "หลับ" หลังไม่มีคนเรียก 15 นาที
        // แล้วตื่นช้า (วัดจริงได้สูงสุด ~86 วิ) ทำให้ request แรกหลัง idle โดน abort ทั้งที่ server
        // กำลังตอบอยู่ — ขยายเป็น 30 วิ (คู่กับ keep-alive ping ที่กันไม่ให้หลับบ่อย ดู Test/)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        try {
            const genreIdsParam = selectedGenres.join(',');
            const res = await fetch(`${SONG_BY_GENRE_URL}?genre_ids=${genreIdsParam}`, {
                signal: controller.signal,
            });
            const json = await res.json();
            const songs = json.data || [];

            const results = songs.map((song) => ({
                id: song.song_id,
                title: song.song_name,
                artist: song.Artist,
                youtube_link: song.youtube_link,
                image_link: song.Image_Link,
            }));

            navigation?.navigate('Result', { results });
        } catch (err) {
            console.log('ดึงเพลงตาม genre ไม่สำเร็จ (หรือรอ server นานเกิน 30 วิ):', err);
            navigation?.navigate('Result', { results: [] });
        } finally {
            clearTimeout(timeoutId);
            setLoadingSongs(false);
        }
    };

    // กด enter ในช่อง search: เอาคำค้นหาไปถามโมเดล Ver.5 (ค้นด้วยความหมาย ไม่ใช่แค่ชื่อเพลงตรงเป๊ะ)
    // ตรรกะเหมือน handleApplyPress เป๊ะๆ (โชว์ loading, ตั้ง timeout กันค้าง, แปลงผลลัพธ์ก่อนส่งไปหน้า Result)
    const handleSearchSubmit = async () => {
        const query = searchQuery.trim();
        if (!query) return;

        setLoadingSongs(true);

        // โมเดลค้นหา (Ver.5) อยู่บน Modal ซึ่ง scale-to-zero วัดจริง cold start ได้ ~24 วิ และมีรอบที่เกิน 30 วิ
        // จนขึ้น "ไม่พบเพลง" ทั้งที่โมเดลแค่กำลังตื่น จึงรอได้นานกว่า handleApplyPress ด้านบน
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        try {
            const res = await fetch(SEARCH_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: query }),
                signal: controller.signal,
            });
            const json = await res.json();
            const matches = json.results || [];

            // โมเดล Ver.5 รู้แค่ song_name/artist ไม่รู้ song_id/youtube_link เพราะไม่เชื่อมกับ
            // database เลย — เอาชื่อเพลงที่เจอไปถาม /Song/by_names เพื่อหา song_id/youtube_link จริง
            // มาเติมให้ (เทียบด้วยชื่อเพลงเท่านั้น ถ้าชื่อซ้ำกันคนละศิลปินอาจจับคู่ผิดเพลงได้)
            let songByName = {};
            try {
                const namesRes = await fetch(SONG_BY_NAMES_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ song_names: matches.map((song) => song.song_name) }),
                    signal: controller.signal,
                });
                const namesJson = await namesRes.json();
                (namesJson.data || []).forEach((song) => {
                    songByName[song.song_name] = song;
                });
            } catch (err) {
                console.log('หา song_id/youtube_link จากชื่อเพลงไม่สำเร็จ:', err);
            }

            // ถ้าผลค้นหาจากโมเดล 2 รายการ ชื่อเพลงตรงกันเป๊ะ (เช่นเพลงชื่อซ้ำกันคนละศิลปิน) จะจับคู่
            // song_id เดียวกันทั้งคู่ (เพราะเทียบแค่ชื่อ แยกศิลปินไม่ออก) ทำให้การ์ดซ้ำกันและ React เตือน
            // error duplicate key — ป้องกันด้วยการเก็บผลลัพธ์แค่ชื่อละ 1 การ์ด (ตัวแรกที่เจอ)
            const seenTitles = new Set();
            const results = [];
            matches.forEach((song) => {
                if (seenTitles.has(song.song_name)) return;
                seenTitles.add(song.song_name);

                const matchedSong = songByName[song.song_name];

                // id ต้องเป็น song_id จริงจาก DB เท่านั้น ถ้าไม่เจอให้เป็น undefined (ไม่ใช้ index
                // แทน) เพราะ Result.js จะเอา id นี้ไปนับ trending — ถ้าใช้ index ปลอมๆ อาจไปนับผิดเพลง
                results.push({
                    id: matchedSong ? matchedSong.song_id : undefined,
                    title: song.song_name,
                    artist: song.artist,
                    youtube_link: matchedSong ? matchedSong.youtube_link : undefined,
                    image_link: matchedSong ? matchedSong.Image_Link : undefined,
                });
            });

            navigation?.navigate('Result', { results });
        } catch (err) {
            console.log('ค้นหาเพลงไม่สำเร็จ (หรือรอโมเดลนานเกิน 60 วิ):', err);
            navigation?.navigate('Result', { results: [] });
        } finally {
            clearTimeout(timeoutId);
            setLoadingSongs(false);
        }
    };

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
                        activeOpacity={0.7}
                        onPress={() => navigation?.navigate('History')}
                    >
                        <Text style={styles.historyText}>History</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.avatarButton}
                        activeOpacity={0.7}
                        onPress={() => navigation?.navigate('Profile')}
                    >
                        <Feather name="user" size={24} color="#111111" />
                    </TouchableOpacity>
                </View>

                {/* App Title */}
                <Text style={styles.appTitle}>
                    Lyri<Text style={styles.appTitleHighlight}>Seek</Text>
                </Text>

                {/* For You Section */}
                <View style={styles.forYouContainer}>
                    <Text style={styles.forYouTitle}>For You</Text>

                    <View style={styles.forYouCardBox}>
                        {forYouList.length > 0 ? (
                            forYouList.map((song) => (
                                <TouchableOpacity
                                    key={song.trend_song_id}
                                    style={styles.songItem}
                                    activeOpacity={0.8}
                                    onPress={() => openRecommendedSong(song)}
                                >
                                    {song.Image_Link ? (
                                        <Image source={{ uri: song.Image_Link }} style={styles.cardPlaceholder} />
                                    ) : (
                                        <View style={styles.cardPlaceholder} />
                                    )}
                                    <Text style={styles.songTitle} numberOfLines={1}>
                                        {song.song_name}
                                    </Text>
                                    {song.Artist ? (
                                        <Text style={styles.songArtist} numberOfLines={1}>
                                            {song.Artist}
                                        </Text>
                                    ) : null}
                                </TouchableOpacity>
                            ))
                        ) : (
                            /* Placeholder UI when waiting for DB */
                            <>
                                <TouchableOpacity
                                    style={styles.songItem}
                                    activeOpacity={0.8}
                                    onPress={() => navigation?.navigate('Result')}
                                >
                                    <View style={styles.cardPlaceholder} />
                                    <Text style={styles.songTitle} numberOfLines={1}>
                                        Song Title
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.songItem}
                                    activeOpacity={0.8}
                                    onPress={() => navigation?.navigate('Result')}
                                >
                                    <View style={styles.cardPlaceholder} />
                                    <Text style={styles.songTitle} numberOfLines={1}>
                                        Song Title
                                    </Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>

                {/* Search & Filter Section */}
                <View style={styles.searchSection}>
                    <View style={styles.searchBar}>
                        <Feather name="search" size={22} color="#C24A3B" style={styles.searchIcon} />
                        <View style={styles.searchInputWrapper}>
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search for music"
                                placeholderTextColor="#777777"
                                textAlign="center"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                onSubmitEditing={handleSearchSubmit}
                            />
                            <Text style={styles.searchSubtext}>lyrics/genre/mood</Text>
                        </View>
                        <TouchableOpacity
                            activeOpacity={0.7}
                            style={[styles.micButton, isRecording && styles.micButtonRecording]}
                            onPress={handleMicPress}
                            disabled={isTranscribing}
                        >
                            {isTranscribing ? (
                                <ActivityIndicator size="small" color="#C24A3B" />
                            ) : (
                                <Feather
                                    name={isRecording ? 'square' : 'mic'}
                                    size={22}
                                    color={isRecording ? '#E53E3E' : '#C24A3B'}
                                />
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Filter Toggle Button */}
                    <TouchableOpacity
                        style={[styles.filterButton, showFilters && styles.filterButtonActive]}
                        activeOpacity={0.8}
                        onPress={handleFilterPress}
                    >
                        <Feather name="filter" size={14} color="#C24A3B" style={styles.filterIcon} />
                        <Text style={styles.filterText}>FILTERS</Text>
                    </TouchableOpacity>

                    {/* Collapsible Filter Panel: แสดงปุ่ม mood และ genre ที่ดึงมาจาก server แยกหัวข้อกัน เป็นแบบ checkbox (ติ๊กได้)
                        เรียงจากแนวที่มีเพลงเยอะสุดไปน้อยสุด (เรียงมาจาก backend แล้ว ฝั่งนี้แค่กรองด้วยช่อง search) */}
                    {showFilters && (
                        <View style={styles.filterPanel}>
                            <Text style={styles.filterSectionTitle}>Mood</Text>
                            <TextInput
                                style={styles.genreSearchInput}
                                placeholder="Search mood"
                                placeholderTextColor="#999999"
                                value={moodSearch}
                                onChangeText={setMoodSearch}
                            />

                            <View style={styles.genreButtonRow}>
                                {moodList
                                    .filter((mood) =>
                                        mood.mood_name.toLowerCase().includes(moodSearch.toLowerCase())
                                    )
                                    .map((mood) => {
                                        const isChecked = selectedMoods.includes(mood.mood_id);
                                        return (
                                            <TouchableOpacity
                                                key={mood.mood_id}
                                                style={[styles.genreButton, isChecked && styles.genreButtonChecked]}
                                                onPress={() => toggleMood(mood)}
                                            >
                                                <Feather
                                                    name={isChecked ? 'check-square' : 'square'}
                                                    size={14}
                                                    color={isChecked ? '#FFFFFF' : '#B84A3B'}
                                                    style={styles.genreCheckboxIcon}
                                                />
                                                <Text
                                                    style={[
                                                        styles.genreButtonText,
                                                        isChecked && styles.genreButtonTextChecked,
                                                    ]}
                                                >
                                                    {mood.mood_name}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                            </View>

                            <Text style={styles.filterSectionTitle}>Genre</Text>
                            <TextInput
                                style={styles.genreSearchInput}
                                placeholder="Search genre"
                                placeholderTextColor="#999999"
                                value={genreSearch}
                                onChangeText={setGenreSearch}
                            />

                            <View style={styles.genreButtonRow}>
                                {genreList
                                    .filter((genre) =>
                                        genre.genre_name.toLowerCase().includes(genreSearch.toLowerCase())
                                    )
                                    .map((genre) => {
                                        const isChecked = selectedGenres.includes(genre.genre_id);
                                        return (
                                            <TouchableOpacity
                                                key={genre.genre_id}
                                                style={[styles.genreButton, isChecked && styles.genreButtonChecked]}
                                                onPress={() => toggleGenre(genre)}
                                            >
                                                <Feather
                                                    name={isChecked ? 'check-square' : 'square'}
                                                    size={14}
                                                    color={isChecked ? '#FFFFFF' : '#B84A3B'}
                                                    style={styles.genreCheckboxIcon}
                                                />
                                                <Text
                                                    style={[
                                                        styles.genreButtonText,
                                                        isChecked && styles.genreButtonTextChecked,
                                                    ]}
                                                >
                                                    {genre.genre_name}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                            </View>

                            <TouchableOpacity
                                style={styles.applyButton}
                                activeOpacity={0.85}
                                onPress={handleApplyPress}
                            >
                                <Text style={styles.applyButtonText}>apply</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* หน้า Loading แบบวงกลมหมุนๆ: โชว์ทับทั้งจอระหว่างรอดึงเพลงตาม genre ที่เลือก */}
            {loadingSongs && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#C24A3B" />
                </View>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFF8F6',
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255,255,255,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
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
        marginBottom: 16,
    },
    historyText: {
        fontSize: 22,
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
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
    },
    appTitle: {
        fontSize: 48,
        fontWeight: 'bold',
        color: '#1F1F1F',
        textAlign: 'center',
        marginVertical: 12,
        letterSpacing: 0.5,
    },
    appTitleHighlight: {
        color: '#C24A3B',
    },
    forYouContainer: {
        marginTop: 6,
        marginBottom: 20,
    },
    forYouTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111111',
        marginBottom: 10,
        marginLeft: 4,
    },
    forYouCardBox: {
        backgroundColor: '#FDEEEB',
        borderWidth: 1.5,
        borderColor: '#F6D5CE',
        borderRadius: 24,
        paddingVertical: 16,
        paddingHorizontal: 12,
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    songItem: {
        width: '46%',
        alignItems: 'center',
    },
    cardPlaceholder: {
        width: '100%',
        aspectRatio: 1.15,
        backgroundColor: '#EACCC5',
        borderRadius: 12,
        marginBottom: 8,
    },
    songTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#111111',
        textAlign: 'center',
    },
    songArtist: {
        fontSize: 11,
        color: '#777777',
        textAlign: 'center',
        marginTop: 2,
    },
    searchSection: {
        width: '100%',
        marginTop: 4,
    },
    searchBar: {
        backgroundColor: '#FFFFFF',
        borderRadius: 30,
        paddingVertical: 10,
        paddingHorizontal: 18,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
    },
    searchIcon: {
        marginRight: 6,
    },
    searchInputWrapper: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    searchInput: {
        width: '100%',
        fontSize: 15,
        color: '#333333',
        fontWeight: '500',
        padding: 0,
        textAlign: 'center',
    },
    searchSubtext: {
        fontSize: 11,
        color: '#888888',
        marginTop: 2,
        textAlign: 'center',
    },
    micButton: {
        marginLeft: 6,
        padding: 4,
    },
    micButtonRecording: {
        backgroundColor: '#FFE5E5',
        borderRadius: 16,
    },
    filterButton: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#F0C0B6',
        borderRadius: 20,
        paddingVertical: 6,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        marginTop: 14,
        marginLeft: 4,
    },
    filterButtonActive: {
        backgroundColor: '#FFF1EE',
        borderColor: '#E8A599',
    },
    filterIcon: {
        marginRight: 6,
    },
    filterText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#B84A3B',
        letterSpacing: 0.5,
    },
    filterPanel: {
        backgroundColor: '#FDEEEB',
        borderWidth: 1.5,
        borderColor: '#F6D5CE',
        borderRadius: 24,
        paddingVertical: 18,
        paddingHorizontal: 14,
        marginTop: 12,
        minHeight: 60,
    },
    filterSectionTitle: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#111111',
        marginBottom: 8,
        marginLeft: 2,
    },
    genreSearchInput: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#F0C0B6',
        borderRadius: 16,
        paddingVertical: 8,
        paddingHorizontal: 14,
        fontSize: 14,
        color: '#333333',
        marginBottom: 10,
    },
    genreButtonRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 10,
    },
    genreButton: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#F0C0B6',
        borderRadius: 16,
        paddingVertical: 6,
        paddingHorizontal: 12,
        margin: 4,
        flexDirection: 'row',
        alignItems: 'center',
    },
    genreButtonChecked: {
        backgroundColor: '#C24A3B',
        borderColor: '#C24A3B',
    },
    genreCheckboxIcon: {
        marginRight: 6,
    },
    genreButtonText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#B84A3B',
    },
    genreButtonTextChecked: {
        color: '#FFFFFF',
    },
    applyButton: {
        backgroundColor: '#C24A3B',
        borderRadius: 14,
        paddingVertical: 6,
        paddingHorizontal: 22,
        alignSelf: 'flex-end',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 1,
    },
    applyButtonText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
});

export default Homeuser;
