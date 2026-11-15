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

// ===================== ตั้งค่าการอัดเสียง =====================
// ฟีเจอร์ค้นหาด้วยเสียง: ผู้ใช้กดไมค์แล้วร้อง/พูดเนื้อเพลง -> อัดเป็นไฟล์เสียง
// -> ส่งไปให้ Google Speech-to-Text แปลงเป็นข้อความ -> เอาข้อความไปใส่ช่องค้นหา
//
// ตั้งค่าไฟล์เสียงให้ตรงกับรูปแบบที่ Google รับได้ โดยแยกตามระบบมือถือ:
//   iOS     -> ไฟล์ .wav แบบ LINEAR16 (เสียงไม่บีบอัด 16 บิต)
//   Android -> ไฟล์ .amr แบบ AMR-WB (บีบอัดแล้ว ไฟล์เล็ก) เพราะ Android อัด .wav โดยตรงไม่ได้
// ทั้งสองแบบใช้ 16000 Hz และเสียงช่องเดียว (mono) ซึ่งพอสำหรับเสียงพูด และไฟล์ไม่ใหญ่
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

// อัดเสียงได้นานสุด 55 วินาที แล้วจะหยุดเอง
// เพราะ Google Speech-to-Text แบบส่งไฟล์ครั้งเดียวรับเสียงได้ไม่เกิน 1 นาที (เผื่อไว้ 5 วินาที)
const MAX_RECORDING_MS = 55000;

// บอก Google ว่าไฟล์เสียงที่ส่งไปเป็นรูปแบบไหน (ต้องตรงกับ RECORDING_OPTIONS ด้านบน)
const GOOGLE_AUDIO_CONFIG =
    Platform.OS === 'ios'
        ? { encoding: 'LINEAR16', sampleRateHertz: 16000 }
        : { encoding: 'AMR_WB', sampleRateHertz: 16000 };

// ===================== ที่อยู่ API =====================
// API บน Render (ข้อมูลเพลงในฐานข้อมูล)
const GENRE_URL = 'https://lyriseek-api-database.onrender.com/Genre';                   // รายการแนวเพลง
const MOOD_URL = 'https://lyriseek-api-database.onrender.com/Mood';                     // รายการอารมณ์เพลง
const SONG_BY_FILTER_URL = 'https://lyriseek-api-database.onrender.com/Song/by_filter'; // หาเพลงตาม genre/mood ที่เลือก
// API บน Modal (โมเดลค้นหาเพลงจากเนื้อร้อง: TF-IDF 80% + Dense 20%)
const SEARCH_URL = 'https://sompon-dev--lyriseek-search-web.us-east.modal.run/search';
// API บน Render (ต่อ)
const SONG_BY_NAMES_URL = 'https://lyriseek-api-database.onrender.com/Song/by_names';             // หาข้อมูลเพลงจากชื่อ
const RECOMMENDED_URL = 'https://lyriseek-api-database.onrender.com/trending_song/recommended';    // เพลงแนะนำ (For You)
const TRENDING_INCREMENT_URL = 'https://lyriseek-api-database.onrender.com/trending_song/increment'; // +1 ยอดฟัง

// ===================== ฟังก์ชันช่วยจับคู่ชื่อศิลปิน =====================
// ปัญหาที่ต้องแก้: โมเดลค้นหา (Modal) รู้แค่ "ชื่อเพลง + ชื่อศิลปิน" ไม่รู้ song_id หรือลิงก์ YouTube
// เราจึงต้องเอาชื่อเพลงไปหาในฐานข้อมูลอีกที แต่ชื่อเพลงซ้ำกันได้ (คนละศิลปินร้องเพลงชื่อเดียวกัน)
// และชื่อศิลปินในสองที่อาจเขียนไม่เหมือนกันเป๊ะ เช่น "Bodyslam" กับ "BODYSLAM (บอดี้สแลม)"
// ฟังก์ชัน 4 ตัวด้านล่างช่วยตัดสินว่า "เป็นศิลปินคนเดียวกันไหม"

// ทำชื่อให้อยู่ในรูปเดียวกันก่อนเทียบ: ตัวพิมพ์เล็กทั้งหมด และลบทุกอย่างที่ไม่ใช่ตัวเลข อังกฤษ หรือไทย
// (ช่องว่าง วงเล็บ ขีด จุด ถูกลบหมด) เช่น "Am Fine!" -> "amfine"
// ช่วง ฀-๿ คือช่วงตัวอักษรไทยทั้งหมดใน Unicode
const normalizeName = (text) => (text || '').toLowerCase().replace(/[^0-9a-z฀-๿]+/g, '');

// สร้าง "ชื่อเรียกทั้งหมด" ของศิลปิน 1 คน เพื่อเอาไปเทียบ
// เช่น "Bodyslam (บอดี้สแลม)" จะได้ 3 ชื่อ:
//   1) ชื่อเต็ม                    -> "bodyslamบอดี้สแลม"
//   2) ชื่อที่ตัดส่วนในวงเล็บออก   -> "bodyslam"
//   3) ชื่อที่อยู่ในวงเล็บ          -> "บอดี้สแลม"
// ชื่อที่สั้นกว่า 2 ตัวอักษรจะถูกตัดทิ้ง เพราะสั้นเกินไปจนไปตรงกับชื่อคนอื่นมั่ว
const artistAliases = (artist) => {
    const inParens = (artist || '').match(/\(([^)]*)\)/g) || [];
    return [artist, (artist || '').replace(/\(.*?\)/g, ''), ...inParens.map((p) => p.slice(1, -1))]
        .map(normalizeName)
        .filter((name) => name.length >= 2);
};

// ตัดสินว่าศิลปิน a กับ b เป็นคนเดียวกันไหม
// ถือว่าใช่ ถ้ามีชื่อเรียกคู่ใดคู่หนึ่งที่ชื่อหนึ่งอยู่ในอีกชื่อหนึ่ง
// เช่น "bodyslam" อยู่ใน "bodyslamบอดี้สแลม" -> ถือเป็นคนเดียวกัน
const isSameArtist = (a, b) =>
    artistAliases(a).some((x) => artistAliases(b).some((y) => x.includes(y) || y.includes(x)));

// จากเพลงทั้งหมดในฐานข้อมูลที่ชื่อตรงกัน (rows) เลือกแถวที่เป็นของศิลปินคนนี้
//   - ไม่มีแถวเลย -> ไม่เจอ (undefined)
//   - มีแถวที่ศิลปินตรงกัน -> ใช้แถวนั้น
//   - ไม่มีแถวไหนตรง แต่มีอยู่แถวเดียวและแถวนั้นไม่ได้ระบุศิลปิน -> ใช้แถวนั้น (น่าจะเป็นเพลงเดียวกัน)
//   - นอกนั้น -> ไม่เจอ (ไม่เดา เพราะอาจเปิดเพลงผิดคน)
const findSongRow = (rows, artist) => {
    if (!rows || rows.length === 0) return undefined;
    const matched = rows.find((row) => isSameArtist(row.Artist, artist));
    if (matched) return matched;
    return rows.length === 1 && !rows[0].Artist ? rows[0] : undefined;
};

// หน้าแรกของผู้ใช้ทั่วไป หาเพลงได้ 3 ทาง:
//   1) พิมพ์เนื้อเพลงที่จำได้ แล้วกดค้นหา        -> handleSearchSubmit (ใช้โมเดลบน Modal)
//   2) กดไมค์แล้วร้อง/พูดเนื้อเพลง               -> startRecording / stopRecording แปลงเสียงเป็นข้อความ
//   3) เลือกแนวเพลง (genre) / อารมณ์เพลง (mood)  -> handleApplyPress (กรองจากฐานข้อมูล)
// และมีส่วน "For You" แสดงเพลงแนะนำที่แอดมินตั้งไว้ (หรือที่ระบบเลือกให้อัตโนมัติ)
const Homeuser = ({ navigation }) => {
    const [searchQuery, setSearchQuery] = useState('');       // ข้อความในช่องค้นหา (พิมพ์เอง หรือได้จากเสียง)
    const [showFilters, setShowFilters] = useState(false);    // แผงตัวกรอง genre/mood เปิดอยู่ไหม
    const [genreList, setGenreList] = useState([]);           // แนวเพลงทั้งหมดในระบบ
    const [genreSearch, setGenreSearch] = useState('');       // คำค้นในช่องค้นหาแนวเพลง
    const [selectedGenres, setSelectedGenres] = useState([]); // genre_id ที่ติ๊กเลือก
    const [moodList, setMoodList] = useState([]);             // อารมณ์เพลงทั้งหมดในระบบ
    const [moodSearch, setMoodSearch] = useState('');         // คำค้นในช่องค้นหาอารมณ์เพลง
    const [selectedMoods, setSelectedMoods] = useState([]);   // mood_id ที่ติ๊กเลือก
    const [loadingSongs, setLoadingSongs] = useState(false);  // true ระหว่างรอผลค้นหา (โชว์วงกลมหมุน)
    const [isRecording, setIsRecording] = useState(false);    // true ระหว่างกำลังอัดเสียง
    const [isTranscribing, setIsTranscribing] = useState(false); // true ระหว่างรอ Google แปลงเสียงเป็นข้อความ

    const [forYouList, setForYouList] = useState([]);         // เพลงแนะนำในส่วน For You

    // ตัวอัดเสียงของ expo-audio ตั้งค่าตาม RECORDING_OPTIONS
    const recorder = useAudioRecorder(RECORDING_OPTIONS);

    // ตอนเปิดหน้า: โหลดเพลงแนะนำ (For You)
    // server จะส่งเพลงที่แอดมินติ๊กไว้มาให้ หรือถ้าเปิดโหมดอัตโนมัติอยู่ จะส่งเพลงที่ระบบเลือกจากสถิติ
    useEffect(() => {
        fetch(RECOMMENDED_URL)
            .then((res) => res.json())
            .then((json) => setForYouList(json.data || []))
            .catch((err) => console.log('โหลดเพลงแนะนำไม่สำเร็จ:', err));
    }, []);

    // กดเพลงในส่วน For You (ทำงานแบบเดียวกับกดเพลงในหน้า Result)
    //   1) ไม่มีลิงก์ YouTube -> แจ้งเตือนแล้วหยุด
    //   2) ทำ 2 อย่างพร้อมกันแล้วรอให้เสร็จ: +1 ยอดฟัง (trending_song) และบันทึกประวัติการฟัง
    //   3) เปิดเพลงใน YouTube
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

    // เริ่มอัดเสียง
    //   1) ขออนุญาตใช้ไมโครโฟน ถ้าผู้ใช้ไม่อนุญาตให้แจ้งเตือนแล้วหยุด
    //   2) ตั้งโหมดเสียงของเครื่องให้อัดได้
    //      playsInSilentMode = อัดได้แม้ iPhone เปิดโหมดเงียบอยู่
    //   3) เตรียมไฟล์ แล้วเริ่มอัด
    //   4) ตั้ง isRecording = true -> ปุ่มไมค์เปลี่ยนหน้าตา และนาฬิกา 55 วินาทีเริ่มนับ (ดู useEffect ด้านล่าง)
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

    // หยุดอัดเสียง แล้วแปลงเสียงเป็นข้อความ
    //   1) หยุดอัด แล้วปิดโหมดอัดเสียงของเครื่อง
    //   2) อ่านไฟล์เสียงที่อัดได้ แปลงเป็นข้อความแบบ base64
    //      (base64 = วิธีเขียนข้อมูลไฟล์เป็นตัวอักษร เพื่อใส่ไปในคำขอแบบ JSON ได้)
    //   3) อ่าน API key ของ Google จากไฟล์ .env ถ้าไม่มีให้แจ้งเตือน
    //   4) ส่งเสียงไปให้ Google Speech-to-Text แปลง โดยระบุว่าเป็นภาษาไทย (th-TH)
    //   5) อ่านผล:
    //        - Google ตอบ error -> แสดงข้อความ error
    //        - ได้ข้อความ -> Google อาจแบ่งเสียงยาวเป็นหลายช่วง (results)
    //          เราเอาคำตอบที่มั่นใจที่สุดของแต่ละช่วง (alternatives[0]) มาต่อกันด้วยช่องว่าง
    //          แล้วใส่ลงช่องค้นหา (ผู้ใช้ตรวจหรือแก้ได้ก่อนกดค้นหา)
    //        - ไม่ได้ข้อความเลย -> แจ้งว่าไม่พบเสียงพูด
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
                const transcript = data.results
                    .map((r) => r.alternatives?.[0]?.transcript?.trim() || '')
                    .filter(Boolean)
                    .join(' ');
                if (transcript) {
                    setSearchQuery(transcript);
                } else {
                    Alert.alert('แจ้งเตือน', 'ไม่พบเสียงพูด หรือไม่สามารถแปลงเสียงได้');
                }
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

    // หยุดอัดเสียงอัตโนมัติเมื่อครบ 55 วินาที
    // ทำงานทุกครั้งที่ isRecording เปลี่ยน:
    //   - เริ่มอัด (true) -> ตั้งนาฬิกา 55 วินาที ครบแล้วเรียก stopRecording
    //   - ผู้ใช้กดหยุดเองก่อน (false) -> คำสั่ง return จะยกเลิกนาฬิกาที่ตั้งไว้ ไม่ให้หยุดซ้ำ
    useEffect(() => {
        if (!isRecording) return;
        const timerId = setTimeout(stopRecording, MAX_RECORDING_MS);
        return () => clearTimeout(timerId);
    }, [isRecording]);

    // กดปุ่มไมค์: ถ้ากำลังอัดอยู่ให้หยุด ถ้ายังไม่อัดให้เริ่มอัด
    // ระหว่างที่ Google กำลังแปลงเสียงอยู่ กดปุ่มไมค์จะไม่มีผล
    const handleMicPress = () => {
        if (isTranscribing) return;
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    // กดปุ่มตัวกรอง: เปิด/ปิดแผงเลือก genre และ mood
    // แล้วโหลดรายการ genre และ mood ล่าสุดจาก server ทุกครั้งที่กด
    // (ถ้าแอดมินเพิ่งเพิ่มหมวดใหม่ ผู้ใช้จะเห็นทันที)
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

    // ติ๊ก/ยกเลิกติ๊กแนวเพลง (ทำงานเหมือน checkbox)
    //   - ติ๊กอยู่แล้ว -> เอา genre_id นี้ออกจากรายการที่เลือก
    //   - ยังไม่ติ๊ก   -> เพิ่ม genre_id นี้เข้าไป
    // ส่วน console.log ด้านล่างใช้ดูใน terminal ตอนทดสอบว่าเลือกอะไรไว้บ้าง (ไม่มีผลกับหน้าจอ)
    const toggleGenre = (genre) => {
        const isChecked = selectedGenres.includes(genre.genre_id);
        let updatedSelectedGenres;

        if (isChecked) {
            updatedSelectedGenres = selectedGenres.filter((id) => id !== genre.genre_id);
        } else {
            updatedSelectedGenres = [...selectedGenres, genre.genre_id];
        }

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

    // ติ๊ก/ยกเลิกติ๊กอารมณ์เพลง (ทำงานแบบเดียวกับ toggleGenre)
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

    // กดปุ่ม Apply: หาเพลงตามแนวเพลง/อารมณ์เพลงที่เลือก (หาเพลงทางที่ 3)
    //   1) ตั้งเวลาหมดอายุ 30 วินาที (server บน Render อาจกำลังตื่นจากการพัก)
    //   2) ส่ง id ที่เลือกไปเป็นข้อความคั่นด้วยจุลภาค เช่น genre_ids=1,3&mood_ids=2
    //      server จะคืนเฉพาะเพลงที่ตรงกับ "ทุก" genre และ "ทุก" mood ที่ติ๊กไว้
    //      (หมวดไหนไม่ได้ติ๊กเลย หมวดนั้นจะไม่ถูกใช้กรอง)
    //   3) แปลงข้อมูลเพลงให้อยู่ในรูปที่หน้า Result ใช้ { id, title, artist, youtube_link, image_link }
    //   4) ไปหน้า Result พร้อมรายการเพลง
    // ถ้าพลาดหรือหมดเวลา ก็ยังไปหน้า Result แต่รายการว่าง (หน้า Result จะแสดงว่าไม่พบเพลง)
    const handleApplyPress = async () => {
        setLoadingSongs(true);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        try {
            const genreIdsParam = selectedGenres.join(',');
            const moodIdsParam = selectedMoods.join(',');
            const res = await fetch(`${SONG_BY_FILTER_URL}?genre_ids=${genreIdsParam}&mood_ids=${moodIdsParam}`, {
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

    // กดค้นหา: ค้นเพลงจากเนื้อร้องที่พิมพ์ (หาเพลงทางที่ 1 และ 2) เป็นฟังก์ชันหลักของแอป
    // มี 4 ขั้น:
    //   ขั้น 1) ส่งข้อความไปให้โมเดลค้นหาบน Modal
    //           โมเดลคืนรายการเพลงที่ใกล้เคียงที่สุด เรียงจากคะแนนสูงไปต่ำ (มีแค่ชื่อเพลง + ศิลปิน)
    //   ขั้น 2) เอาชื่อเพลงทั้งหมดไปถาม Render (/Song/by_names) เพื่อเอา song_id, ลิงก์ YouTube, รูปปก
    //           จัดกลุ่มผลลัพธ์ตามชื่อเพลง (songsByName) เพราะชื่อเดียวอาจมีหลายเพลง (คนละศิลปิน)
    //           ถ้าขั้นนี้พลาด ยังแสดงผลได้ แค่ไม่มีลิงก์และรูป
    //   ขั้น 3) จับคู่ผลจากโมเดลกับแถวในฐานข้อมูล ด้วย findSongRow (เทียบชื่อศิลปิน)
    //           และตัดเพลงซ้ำออก: ใช้ song_id เป็นตัวระบุ ถ้าหาไม่เจอใช้ชื่อเพลง + ชื่อศิลปินแทน
    //           Set = กล่องที่จำว่าเจอเพลงไหนไปแล้ว ถ้าเจอซ้ำให้ข้าม
    //           ลำดับยังคงเรียงตามคะแนนจากโมเดลเหมือนเดิม
    //   ขั้น 4) ไปหน้า Result พร้อมรายการเพลง
    // ตั้งเวลาหมดอายุไว้ 60 วินาที เพราะ Modal ปิดตัวเองตอนไม่มีคนใช้
    // ครั้งแรกที่ถูกปลุก (cold start) ใช้เวลาประมาณ 20-30 วินาทีกว่าจะพร้อม
    // ถ้าพลาดหรือหมดเวลา จะไปหน้า Result แบบรายการว่าง
    const handleSearchSubmit = async () => {
        const query = searchQuery.trim();
        if (!query) return;

        setLoadingSongs(true);

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

            const songsByName = {};
            try {
                const namesRes = await fetch(SONG_BY_NAMES_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ song_names: matches.map((song) => song.song_name) }),
                    signal: controller.signal,
                });
                const namesJson = await namesRes.json();
                (namesJson.data || []).forEach((song) => {
                    (songsByName[song.song_name] = songsByName[song.song_name] || []).push(song);
                });
            } catch (err) {
                console.log('หา song_id/youtube_link จากชื่อเพลงไม่สำเร็จ:', err);
            }

            const seenSongs = new Set();
            const results = [];
            matches.forEach((song) => {
                const matchedSong = findSongRow(songsByName[song.song_name], song.artist);
                const songKey = matchedSong
                    ? `id:${matchedSong.song_id}`
                    : `name:${song.song_name}|${normalizeName(song.artist)}`;
                if (seenSongs.has(songKey)) return;
                seenSongs.add(songKey);

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

                <Text style={styles.appTitle}>
                    Lyri<Text style={styles.appTitleHighlight}>Seek</Text>
                </Text>

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

                <View style={styles.searchSection}>
                    <View style={styles.searchBar}>
                        <Feather name="search" size={22} color="#C24A3B" style={styles.searchIcon} />
                        <View style={styles.searchInputWrapper}>
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search For music"
                                placeholderTextColor="#777777"
                                textAlign="center"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                onSubmitEditing={handleSearchSubmit}
                            />
                            
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

                    <TouchableOpacity
                        style={[styles.filterButton, showFilters && styles.filterButtonActive]}
                        activeOpacity={0.8}
                        onPress={handleFilterPress}
                    >
                        <Feather name="filter" size={14} color="#C24A3B" style={styles.filterIcon} />
                        <Text style={styles.filterText}>FILTERS</Text>
                    </TouchableOpacity>

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
