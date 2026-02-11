import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Home } from "./pages/Home";
import { AttractionDetail } from "./pages/AttractionDetail";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { Profile } from "./pages/Profile";
import { UserProfile } from "./pages/UserProfile";
import { UserTab } from "./pages/UserTab";
import { PeopleList } from "./pages/PeopleList";
import { DiscoverPeople } from "./pages/DiscoverPeople";
import { MyLists } from "./pages/MyLists";
import { ListDetail } from "./pages/ListDetail";
import { Map } from "./pages/Map";

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <ErrorBoundary>
          <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/map" element={<Map />} />
          <Route path="/attraction/:id" element={<AttractionDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/:tab" element={<PeopleList />} />
          <Route path="/user/:id" element={<UserProfile />} />
          <Route path="/user/:id/following" element={<UserTab />} />
          <Route path="/user/:id/followers" element={<UserTab />} />
          <Route path="/user/:id/lists" element={<UserTab />} />
          <Route path="/people" element={<DiscoverPeople />} />
          <Route path="/lists" element={<MyLists />} />
          <Route path="/lists/:id" element={<ListDetail />} />
          <Route path="/inbox" element={<Navigate to="/profile/friends" replace />} />
            <Route path="/profile/activity" element={<Navigate to="/profile/friends" replace />} />
          </Routes>
        </ErrorBoundary>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
