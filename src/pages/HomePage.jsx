import HeaderNavigation from "../components/layout/HeaderNavigation.jsx";
import FooterSection from "../components/layout/FooterSection.jsx";
import ProductGridList from "../components/product/ProductGridList.jsx";

const HomePage = () => {
  return (
    <>
      <HeaderNavigation />
      <ProductGridList />
      <FooterSection />
    </>
  );
};

export default HomePage;