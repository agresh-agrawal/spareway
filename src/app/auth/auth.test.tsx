import { fireEvent, screen, waitFor } from '@testing-library/react'
import { fakeAuth, renderAt } from '@/test/renderWithAuth'
import { PublicOnly, RequireAuth, safeNext } from './guards'
import SignupPage from '@/features/auth/pages/SignupPage'
import LoginPage from '@/features/auth/pages/LoginPage'
import { AppError } from '@/lib/errors'

describe('guards', () => {
  it('RequireAuth sends a signed-out owner to /login with ?next', () => {
    renderAt(
      <RequireAuth>
        <p>secret</p>
      </RequireAuth>,
      { path: '/settings', at: '/settings', auth: fakeAuth({ status: 'signedOut' }) },
    )
    expect(screen.getByTestId('at').textContent).toBe('login?next=%2Fsettings')
  })

  it('RequireAuth shows "Setting up your demo trucks…" while seeding', () => {
    renderAt(
      <RequireAuth>
        <p>secret</p>
      </RequireAuth>,
      { path: '/', at: '/', auth: fakeAuth({ status: 'preparing' }) },
    )
    expect(screen.getByText(/Setting up your demo trucks/)).toBeInTheDocument()
  })

  it('RequireAuth renders the page when ready', () => {
    renderAt(
      <RequireAuth>
        <p>secret</p>
      </RequireAuth>,
      { path: '/x', at: '/x', auth: fakeAuth({ status: 'ready' }) },
    )
    expect(screen.getByText('secret')).toBeInTheDocument()
  })

  it('PublicOnly sends a signed-in owner to ?next or Home', () => {
    renderAt(
      <PublicOnly>
        <p>login form</p>
      </PublicOnly>,
      { path: '/signup', at: '/signup?next=/trips', auth: fakeAuth({ status: 'ready' }) },
    )
    expect(screen.getByTestId('at').textContent).toBe('trips')
  })

  it('safeNext blocks other sites', () => {
    expect(safeNext('//evil.com')).toBe('/')
    expect(safeNext('https://evil.com')).toBe('/')
    expect(safeNext('/trips/1')).toBe('/trips/1')
  })
})

describe('sign-up states (mocked)', () => {
  const fill = () => {
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Agresh Agrawal' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'truck1234' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'truck1234' } })
    fireEvent.click(screen.getByRole('button', { name: /Create account/ }))
  }

  it('needs confirmation → "Check your email"', async () => {
    const signUp = vi.fn(async () => ({ needsConfirmation: true }))
    renderAt(<SignupPage />, { path: '/signup', at: '/signup', auth: fakeAuth({ signUp }) })
    fill()
    await waitFor(() => expect(screen.getByText('Check your email')).toBeInTheDocument())
    expect(signUp).toHaveBeenCalledWith({ fullName: 'Agresh Agrawal', companyName: '', email: 'owner@example.com', password: 'truck1234' })
  })

  it('weak password is caught before sending', async () => {
    const signUp = vi.fn(async () => ({ needsConfirmation: true }))
    renderAt(<SignupPage />, { path: '/signup', at: '/signup', auth: fakeAuth({ signUp }) })
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'A' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.co' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'short' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'short' } })
    fireEvent.click(screen.getByRole('button', { name: /Create account/ }))
    await waitFor(() => expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument())
    expect(signUp).not.toHaveBeenCalled()
  })

  it('email taken shows the plain message and keeps typed text', async () => {
    const signUp = vi.fn(async () => {
      throw new AppError('EMAIL_TAKEN')
    })
    renderAt(<SignupPage />, { path: '/signup', at: '/signup', auth: fakeAuth({ signUp }) })
    fill()
    await waitFor(() => expect(screen.getByText('An account with this email already exists')).toBeInTheDocument())
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('owner@example.com')
  })

  it('wrong password on log in → "Email or password is wrong"', async () => {
    const signInWithPassword = vi.fn(async () => {
      throw new AppError('INVALID_LOGIN')
    })
    renderAt(<LoginPage />, { path: '/login', at: '/login', auth: fakeAuth({ signInWithPassword }) })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'nope12345' } })
    fireEvent.click(screen.getByRole('button', { name: /Log in/ }))
    await waitFor(() => expect(screen.getByText('Email or password is wrong')).toBeInTheDocument())
  })
})
