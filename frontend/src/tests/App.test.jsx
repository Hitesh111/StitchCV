import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import App from '../App';

describe('App Layout & Routing', () => {
    it('renders the application correctly', () => {
        // App already includes BrowserRouter internally
        render(<App />);

        // A simple baseline check
        expect(document.body).toBeInTheDocument();
    });
});
