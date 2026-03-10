import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import './index.css';
import './App.css';
import './styles/menuDropdown.css';
import './styles/staffTable.css';
import { ChakraProvider } from '@chakra-ui/react';
import theme from './theme';

const container = document.getElementById('root')!;
const root = createRoot(container);
root.render(
	<React.StrictMode>
		<ChakraProvider theme={theme}>
				<AuthProvider>
					<BrowserRouter>
						<App />
					</BrowserRouter>
				</AuthProvider>
		</ChakraProvider>
	</React.StrictMode>
);
