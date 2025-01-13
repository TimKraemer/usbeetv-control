export default function Providers({ providers }) {
  if (!providers) return null

  const renderProviderList = (providerType) => {
    if (!providers[providerType]) return null

    return (
      <ul className="flex flex-col gap-2">
        {providers[providerType].map((provider) => (
          <li key={provider.provider_id}>
            <a
              href={providers.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2"
            >
              <img
                src={`https://media.themoviedb.org/t/p/original/${provider.logo_path}`}
                alt={`${provider.provider_name} logo`}
                className="w-10 h-10 rounded-md"
              />
              {provider.provider_name}
            </a>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="flex flex-col gap-4 mt-4">
      <h3 className="text-lg font-bold">
        Bei folgenden Anbietern wurde es gefunden:
      </h3>
      <p>
        Liste von{" "}
        <a
          href="https://www.justwatch.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          JustWatch
        </a>
      </p>
      <div>
        <h4 className="text-base font-bold">Flatrate</h4>
        {renderProviderList("flatrate")}
      </div>
      <div>
        <h4 className="text-base font-bold">Mieten</h4>
        {renderProviderList("rent")}
      </div>
      <div>
        <h4 className="text-base font-bold">Kaufen</h4>
        {renderProviderList("buy")}
      </div>
    </div>
  )
}
