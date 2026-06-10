import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import StudentDashboardClient from '@/app/student-dashboard/components/StudentDashboard';
import MessStaffDashboardClient from '@/app/mess-staff-dashboard/components/MessStaffDashboard';
import WardenAnalyticsClient from '@/app/warden-analytics/components/WardenAnalytics';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

jest.mock('@/app/student-dashboard/components/TodayMealCard', () => () => <div>Today Meal Card</div>);
jest.mock('@/app/student-dashboard/components/VotingWidget', () => () => <div>Voting Widget</div>);
jest.mock('@/app/student-dashboard/components/EmojiRatingSection', () => () => <div>Emoji Rating Section</div>);
jest.mock('@/app/student-dashboard/components/LeftoverClaim', () => () => <div>Leftover Claim</div>);
jest.mock('@/app/student-dashboard/components/ComplaintBox', () => () => <div>Complaint Box</div>);
jest.mock('@/app/student-dashboard/components/BadgesStrip', () => () => <div>Badges Strip</div>);

jest.mock('@/app/mess-staff-dashboard/components/StaffKPIRow', () => () => <div>Staff KPI Row</div>);
jest.mock('@/app/mess-staff-dashboard/components/CookingPlanTable', () => () => <div>Cooking Plan Table</div>);
jest.mock('@/app/mess-staff-dashboard/components/IngredientCalculator', () => () => <div>Ingredient Calculator</div>);
jest.mock('@/app/mess-staff-dashboard/components/RatingsChart', () => () => <div>Ratings Chart</div>);
jest.mock('@/app/mess-staff-dashboard/components/WasteLogger', () => () => <div>Waste Logger</div>);
jest.mock('@/app/mess-staff-dashboard/components/LiveOptInCount', () => () => <div>Live Opt-In Counter</div>);

jest.mock('@/app/warden-analytics/components/WardenKPIRow', () => () => <div>Warden KPI Row</div>);
jest.mock('@/app/warden-analytics/components/FoodWasteChart', () => () => <div>Food Waste Chart</div>);
jest.mock('@/app/warden-analytics/components/SatisfactionMeter', () => () => <div>Satisfaction Metrics</div>);
jest.mock('@/app/warden-analytics/components/AttendanceTrend', () => () => <div>Attendance Trends</div>);
jest.mock('@/app/warden-analytics/components/CostTracking', () => () => <div>Cost Tracking</div>);
jest.mock('@/app/warden-analytics/components/SustainabilityKPI', () => () => <div>Sustainability KPIs</div>);
jest.mock('@/app/warden-analytics/components/WardenMenuVotesCard', () => () => <div>Warden Menu Votes Card</div>);
jest.mock('@/app/warden-analytics/components/WardenComplaintInsights', () => () => <div>Warden Complaint Insights</div>);

describe('Dashboard smoke coverage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders the student dashboard shell', () => {
    render(<StudentDashboardClient />);

    expect(screen.getByText('Hey, Student! 👋')).toBeInTheDocument();
    expect(screen.getByText('Today Meal Card')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Menu' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Vote/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'History' })).toBeInTheDocument();
  });

  it('renders the staff dashboard shell', () => {
    render(<MessStaffDashboardClient />);

    expect(screen.getByText('Mess Staff Dashboard')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cooking Plan' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ingredients' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ratings' })).toBeInTheDocument();
    expect(screen.getByText('Staff KPI Row')).toBeInTheDocument();
    expect(screen.getByText('Live Opt-In Counter')).toBeInTheDocument();
  });

  it('renders the warden analytics shell', () => {
    render(<WardenAnalyticsClient />);

    expect(screen.getByText('Warden Analytics')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Overview/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Food Waste/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Satisfaction/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Attendance/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cost Tracking/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sustainability/ })).toBeInTheDocument();
    expect(screen.getByText('Warden KPI Row')).toBeInTheDocument();
    expect(screen.getByText('Food Waste Chart')).toBeInTheDocument();
  });
});