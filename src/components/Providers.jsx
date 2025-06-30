import Image from "next/image"

export default function Providers({ providers }) {
  if (!providers) return null

  const renderProviderList = (providerType) => {
    if (!providers[providerType] || !Array.isArray(providers[providerType]))
      return null

    return (
      <ul className="flex flex-col gap-2">
        {providers[providerType].map((provider) => {
          if (!provider || !provider.provider_id || !provider.provider_name)
            return null

          return (
            <li key={provider.provider_id}>
              <a
                href={providers.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                {provider.logo_path ? (
                  <Image
                    src={`https://media.themoviedb.org/t/p/original/${provider.logo_path}`}
                    alt={`${provider.provider_name} logo`}
                    width={40}
                    height={40}
                    className="w-10 h-10 rounded-md"
                  />
                ) : (
                  <div className="w-10 h-10 bg-gray-200 rounded-md flex items-center justify-center text-xs text-gray-500">
                    {provider.provider_name.charAt(0).toUpperCase()}
                  </div>
                )}
                {provider.provider_name}
              </a>
            </li>
          )
        })}
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
