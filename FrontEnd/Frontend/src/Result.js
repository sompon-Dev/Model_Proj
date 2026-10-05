import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

const CARDS = [1, 2, 3];

const Result = ({ navigation }) => {
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="light" />
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Header: History & Avatar */}
                <View style={styles.header}>
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => navigation?.goBack()}
                    >
                        <Text style={styles.historyText}>History</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.avatarPlaceholder}
                        activeOpacity={0.7}
                    />
                </View>

                {/* Cards List */}
                <View style={styles.cardList}>
                    {CARDS.map((item) => (
                        <TouchableOpacity
                            key={item}
                            style={styles.card}
                            activeOpacity={0.85}
                        >
                            <View style={styles.imagePlaceholder} />
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#C86452',
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingTop: 12,
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 32,
    },
    historyText: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#000000',
    },
    avatarPlaceholder: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: '#FFFFFF',
    },
    cardList: {
        width: '100%',
        gap: 18,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 4,
        paddingVertical: 14,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 76,
    },
    imagePlaceholder: {
        width: 70,
        height: 52,
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        borderRadius: 3,
    },
});

export default Result;
