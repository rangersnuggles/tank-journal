export const metadata = {
  title: "Tank Journal",
  description: "Freshwater planted aquarium log",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: "#fff" }}>
        {children}
      </body>
    </html>
  );
}
