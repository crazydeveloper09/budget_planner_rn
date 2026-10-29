import { NavigationContainer } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ErrorBoundary from './src/components/ErrorBoundary';
import { AuthProvider } from './src/contexts/AuthContext';
import { ChatProvider } from './src/contexts/ChatContext';
import { FinanceProvider } from './src/contexts/FinanceContext';
import { ProfileProvider } from './src/contexts/ProfileContext';
import { ThemeProvider } from './src/contexts/ThemeContext';
import ChatPushListener from './src/notifications/ChatPushListener';
import { navigationRef } from './src/navigators/navigationRef';
import RootNavigator from './src/navigators/Root';

export default function App() {
  useFonts({
    'FontAwesome': require('./assets/fonts/FontAwesome.ttf'),
    'InterThin': require('./assets/fonts/inter/Inter-Thin.ttf'),
    'InterRegular': require('./assets/fonts/inter/Inter-Regular.ttf'),
    'InterSemiBold': require('./assets/fonts/inter/Inter-SemiBold.ttf'),
    'MontserratRegular': require('./assets/fonts/montserrat/Montserrat-Regular.ttf'),
    'MontserratSemiBold': require('./assets/fonts/montserrat/Montserrat-SemiBold.ttf'),
    'PoppinsThin': require('./assets/fonts/Poppins/Poppins-Thin.ttf'),
    'PoppinsSemiBold': require('./assets/fonts/Poppins/Poppins-SemiBold.ttf'),
    'PoppinsRegular': require('./assets/fonts/Poppins/Poppins-Regular.ttf'),
    'SatisfyRegular': require('./assets/fonts/Satisfy/Satisfy-Regular.ttf')
  });

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider style={styles.root}>
        <ThemeProvider>
          <ErrorBoundary>
            <AuthProvider>
              <ProfileProvider>
                <FinanceProvider>
                  <ChatProvider>
                    <NavigationContainer ref={navigationRef}>
                      <ChatPushListener />
                      <RootNavigator />
                    </NavigationContainer>
                  </ChatProvider>
                </FinanceProvider>
              </ProfileProvider>
            </AuthProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
